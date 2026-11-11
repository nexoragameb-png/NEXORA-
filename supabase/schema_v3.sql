-- NEXORA backend v3 (app v2.0.0) — idempotent; safe to re-run.
--  * matchmaking rewrite: serialized per queue (advisory lock), no double joins, server auto-start, stale-room sweeps (pg_cron)
--  * ARENA DUEL tiers with server-side entry fees / prizes / refunds
--  * WORLD CUP: monthly, top-64 of the monthly ranking, 16 groups of 4 → knockout, 500 gems to the winner
--  * disc packs (130–300 gems), varied daily challenges, club-vs-club team challenges, social (talk) rooms,
--    room management (host transfer, privacy), tournament rewards = gems only (≤30; World Cup is the one exception)

-- ============ CLEANUP: ambiguous overload from v1 ============
-- v1 quick_match(text) + v2 quick_match(text, text default) made rpc('quick_match',{p_mode}) ambiguous
drop function if exists public.quick_match(text);

-- ============ ROOMS: kinds, duel tier ============
alter table public.rooms add column if not exists tier text;
alter table public.rooms drop constraint if exists rooms_kind_check;
alter table public.rooms add constraint rooms_kind_check check (kind in ('casual','quick','arena','tournament','duel','social'));
create index if not exists rooms_mm_idx on public.rooms(kind, mode, status);
create index if not exists rp_last_seen on public.room_players(last_seen);

-- ============ ARENA DUEL TIERS ============
create table if not exists public.arena_tiers (
  id text primary key, name text not null, name_fa text not null, currency text not null check (currency in ('coins','gems')),
  entry int not null check (entry > 0), prize int not null check (prize > 0), goals int not null, time_s int not null, sort int not null,
  rule_fa text not null default ''
);
insert into public.arena_tiers(id,name,name_fa,currency,entry,prize,goals,time_s,sort,rule_fa) values
 ('bermuda','BERMUDA ARENA','آرنای برمودا','coins',100,200,3,0,1,'قوانین عادی · تا ۳ گل'),
 ('nexora','NEXORA ARENA','آرنای نکسورا','coins',250,500,3,0,2,'اولین تیمی که ۳ گل بزند'),
 ('nx','NX ARENA','آرنای NX','coins',500,1000,99,300,3,'۵ دقیقه · جلوتر برنده است'),
 ('space','SPACE ARENA','آرنای فضا','coins',2000,4000,99,180,4,'۳ دقیقه'),
 ('kakero','KAKERO ARENA','آرنای کاکرو','gems',50,100,5,0,5,'اولین تیمی که ۵ گل بزند')
on conflict (id) do update set name=excluded.name, name_fa=excluded.name_fa, currency=excluded.currency, entry=excluded.entry,
  prize=excluded.prize, goals=excluded.goals, time_s=excluded.time_s, sort=excluded.sort, rule_fa=excluded.rule_fa;
alter table public.arena_tiers enable row level security;
drop policy if exists "read" on public.arena_tiers;
create policy "read" on public.arena_tiers for select using (true);

create table if not exists public.arena_stakes (
  match_id uuid references public.matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  tier text not null references public.arena_tiers(id),
  currency text not null, amount int not null, prize int not null default 0,
  status text not null default 'held' check (status in ('held','paid','lost','refunded')),
  created_at timestamptz not null default now(), settled_at timestamptz,
  primary key (match_id, user_id)
);
alter table public.arena_stakes enable row level security;
drop policy if exists "read own" on public.arena_stakes;
create policy "read own" on public.arena_stakes for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.arena_tiers, public.arena_stakes from authenticated, anon;

create or replace function public._refund_stakes(p_match uuid) returns void language plpgsql security definer set search_path=public as $$
declare s record; begin
  for s in select * from arena_stakes where match_id=p_match and status='held' for update loop
    if s.currency='gems' then update profiles set gems=gems+s.amount where id=s.user_id;
    else update profiles set coins=coins+s.amount where id=s.user_id; end if;
    update arena_stakes set status='refunded', settled_at=now() where match_id=p_match and user_id=s.user_id;
  end loop; end $$;

-- ============ ROOM CREATION (adds p_kind) ============
drop function if exists public.create_room(text,text,boolean,boolean,boolean,jsonb);
create or replace function public.create_room(p_mode text, p_name text default null, p_private boolean default false,
  p_ranked boolean default true, p_voice boolean default true, p_settings jsonb default null, p_kind text default 'casual')
returns public.rooms language plpgsql security definer set search_path=public as $$
declare r rooms; begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('casual','social','quick','arena','duel') then raise exception 'bad kind'; end if;
  perform leave_all_rooms();
  insert into rooms(code,name,host,mode,is_private,ranked,voice,settings,kind)
  values (_gen_code(), coalesce(nullif(trim(p_name),''), case when p_kind='social' then 'اتاق گفتگو' else 'اتاق '||p_mode end), auth.uid(), p_mode, p_private,
          p_ranked and p_kind<>'social', p_voice, coalesce(p_settings,'{"goals":3,"time":0,"field":6,"turn":15}'::jsonb), p_kind) returning * into r;
  insert into room_players(room_id,user_id,role,team,slot) values (r.id, auth.uid(),'player',0,0);
  return r; end $$;

-- ============ START (internal, server-authoritative, charges duel fees) ============
create or replace function public._start_match(p_room uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r rooms; n int; a uuid[]; b uuid[]; mid uuid; tm tournament_matches; tr arena_tiers; u uuid; broke uuid[] := '{}'; bal int; begin
  select * into r from rooms where id=p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.kind='social' then raise exception 'not allowed'; end if;
  if r.status<>'waiting' then return r.current_match; end if;
  n := room_size(r.mode);
  select array_agg(user_id order by slot) into a from room_players where room_id=p_room and role='player' and team=0;
  select array_agg(user_id order by slot) into b from room_players where room_id=p_room and role='player' and team=1;
  if coalesce(array_length(a,1),0)<>n or coalesce(array_length(b,1),0)<>n then raise exception 'teams not full'; end if;
  if r.kind='duel' then
    select * into tr from arena_tiers where id=r.tier;
    if tr.id is null then raise exception 'bad tier'; end if;
    perform 1 from profiles where id = any(a||b) for update;
    foreach u in array a||b loop
      select case when tr.currency='gems' then gems else coins end into bal from profiles where id=u;
      if coalesce(bal,0) < tr.entry then broke := broke || u; end if;
    end loop;
    if array_length(broke,1) > 0 then
      -- players who can no longer pay the entry fee lose their seat; nobody is charged
      delete from room_players where room_id=p_room and user_id = any(broke);
      update rooms set updated_at=now() where id=p_room;
      return null;
    end if;
  end if;
  if r.tournament_match_id is not null then select * into tm from tournament_matches where id=r.tournament_match_id; end if;
  insert into matches(room_id,mode,team_a,team_b,ranked,tournament_id,tournament_match_id)
    values (p_room,r.mode,a,b,r.ranked,tm.tournament_id,r.tournament_match_id) returning id into mid;
  if r.kind='duel' then
    foreach u in array a||b loop
      if tr.currency='gems' then update profiles set gems=gems-tr.entry where id=u; else update profiles set coins=coins-tr.entry where id=u; end if;
      insert into arena_stakes(match_id,user_id,tier,currency,amount) values (mid,u,tr.id,tr.currency,tr.entry);
    end loop;
  end if;
  update rooms set status='playing', current_match=mid, updated_at=now() where id=p_room;
  update room_players set last_seen=now() where room_id=p_room;
  if tm.id is not null then update tournament_matches set status='live' where id=tm.id; end if;
  return mid; end $$;

create or replace function public.start_match(p_room uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r rooms; begin
  select * into r from rooms where id=p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.status<>'waiting' then raise exception 'already started'; end if;
  if r.kind in ('quick','arena','duel') then
    -- matchmade rooms: any seated player may trigger the start once everyone is ready
    if not exists(select 1 from room_players where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'not allowed'; end if;
    if exists(select 1 from room_players where room_id=p_room and role='player' and not ready) then raise exception 'not all ready'; end if;
  else
    if r.host<>auth.uid() then raise exception 'host only'; end if;
    if exists(select 1 from room_players where room_id=p_room and role='player' and not ready and user_id<>r.host) then raise exception 'not all ready'; end if;
  end if;
  return _start_match(p_room); end $$;

-- ============ SWEEP (pg_cron every minute + called by matchmaking) ============
create or replace function public._sweep_rooms() returns void language plpgsql security definer set search_path=public as $$
declare r record; nh uuid; m record; begin
  -- 1) silent players (> 45 s without heartbeat) leave waiting rooms
  delete from room_players rp using rooms ro where ro.id=rp.room_id and ro.status='waiting' and rp.last_seen < now() - interval '45 seconds';
  -- 2) matches nobody is heartbeating for (> 90 s) or running > 40 min are abandoned and refunded
  for m in select mt.id, mt.room_id from matches mt where mt.status='live' and (
      mt.started_at < now() - interval '40 minutes'
      or not exists(select 1 from room_players p where p.room_id=mt.room_id and p.last_seen > now() - interval '90 seconds')) loop
    update matches set status='abandoned', ended_at=now() where id=m.id;
    perform _refund_stakes(m.id);
    update tournament_matches set status='ready' where id=(select tournament_match_id from matches where id=m.id) and status='live';
    update rooms set status='waiting', current_match=null, updated_at=now() where id=m.room_id;
    update room_players set ready=false where room_id=m.room_id;
  end loop;
  -- 3) matchmade rooms that never filled within 10 min are closed
  delete from rooms ro where ro.status='waiting' and ro.kind in ('quick','arena','duel') and ro.updated_at < now() - interval '10 minutes';
  -- 4) empty rooms
  delete from rooms ro where not exists(select 1 from room_players p where p.room_id=ro.id);
  -- 5) host left → next player becomes host
  for r in select ro.id from rooms ro where not exists(select 1 from room_players p where p.room_id=ro.id and p.user_id=ro.host) loop
    select user_id into nh from room_players where room_id=r.id order by (role='player') desc, joined_at limit 1;
    update rooms set host=nh, updated_at=now() where id=r.id;
  end loop;
end $$;

-- ============ MATCHMAKING ============
create or replace function public._matchmake(p_mode text, p_kind text, p_tier text) returns public.rooms language plpgsql security definer set search_path=public as $$
declare rid uuid; r rooms; my int; tr arena_tiers; cnt int; begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_mode not in ('1v1','2v2','3v3') then raise exception 'bad mode'; end if;
  -- one matchmaker at a time per queue: concurrent callers can no longer each create their own room
  perform pg_advisory_xact_lock(hashtext('nexora-mm:'||p_mode||':'||p_kind||':'||coalesce(p_tier,'')));
  perform _sweep_rooms();
  -- already queued in this exact queue → return the same room (no double join)
  select ro.* into r from rooms ro join room_players p on p.room_id=ro.id and p.user_id=auth.uid()
    where ro.kind=p_kind and ro.mode=p_mode and coalesce(ro.tier,'')=coalesce(p_tier,'') and ro.status in ('waiting','playing') limit 1;
  if r.id is not null then
    update room_players set ready=true, last_seen=now() where room_id=r.id and user_id=auth.uid() and role='player';
    return r;
  end if;
  if exists(select 1 from room_players p join rooms ro on ro.id=p.room_id where p.user_id=auth.uid() and p.role='player' and ro.status='playing') then
    raise exception 'match running';
  end if;
  select case when p_kind='arena' then arena_points else rating end into my from profiles where id=auth.uid();
  select ro.id into rid from rooms ro
  where ro.mode=p_mode and ro.kind=p_kind and coalesce(ro.tier,'')=coalesce(p_tier,'') and ro.status='waiting' and not ro.is_private
    and (select count(*) from room_players p where p.room_id=ro.id and p.role='player') < room_size(ro.mode)*2
    and exists(select 1 from room_players p where p.room_id=ro.id and p.last_seen > now() - interval '30 seconds')
  order by abs(coalesce((select avg(case when p_kind='arena' then pr.arena_points else pr.rating end) from room_players p join profiles pr on pr.id=p.user_id
             where p.room_id=ro.id and p.role='player'), my) - my),
           (select count(*) from room_players p where p.room_id=ro.id and p.role='player') desc, ro.created_at
  limit 1;
  if rid is null then
    if p_kind='duel' then
      select * into tr from arena_tiers where id=p_tier;
      r := create_room(p_mode, tr.name||' · '||p_mode, false, true, true,
             jsonb_build_object('goals',tr.goals,'time',tr.time_s,'turn',15,'field',(floor(random()*29))::int,'ball',0,'tier',tr.id), 'duel');
      update rooms set tier=tr.id where id=r.id returning * into r;
    else
      r := create_room(p_mode, case when p_kind='arena' then 'آرنا '||p_mode else 'مسابقه سریع '||p_mode end, false, true, true,
             '{"goals":3,"time":0,"field":6,"turn":15,"ball":0}'::jsonb, p_kind);
    end if;
  else
    r := join_room(null, rid, false);
  end if;
  update room_players set ready=true, last_seen=now() where room_id=r.id and user_id=auth.uid();
  select count(*) into cnt from room_players where room_id=r.id and role='player' and ready;
  if cnt = room_size(p_mode)*2 then perform _start_match(r.id); end if;
  select * into r from rooms where id=r.id;
  return r; end $$;

create or replace function public.quick_match(p_mode text, p_kind text default 'quick') returns public.rooms language plpgsql security definer set search_path=public as $$
begin
  if p_kind not in ('quick','arena') then raise exception 'bad kind'; end if;
  return _matchmake(p_mode, p_kind, null); end $$;

create or replace function public.duel_join(p_tier text, p_mode text default '1v1') returns public.rooms language plpgsql security definer set search_path=public as $$
declare tr arena_tiers; bal int; begin
  select * into tr from arena_tiers where id=p_tier; if tr.id is null then raise exception 'bad tier'; end if;
  select case when tr.currency='gems' then gems else coins end into bal from profiles where id=auth.uid();
  if coalesce(bal,0) < tr.entry then raise exception '%', case when tr.currency='gems' then 'not enough gems' else 'not enough coins' end; end if;
  return _matchmake(p_mode, 'duel', p_tier); end $$;

-- ============ ROOM MANAGEMENT ============
create or replace function public.transfer_host(p_room uuid, p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from rooms where id=p_room and host=auth.uid()) then raise exception 'host only'; end if;
  if not exists(select 1 from room_players where room_id=p_room and user_id=p_user) then raise exception 'not in room'; end if;
  update rooms set host=p_user, updated_at=now() where id=p_room; end $$;

create or replace function public.update_room_meta(p_room uuid, p_private boolean default null, p_voice boolean default null, p_ranked boolean default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from rooms where id=p_room and host=auth.uid() and status='waiting' and kind in ('casual','social')) then raise exception 'host only'; end if;
  update rooms set is_private=coalesce(p_private,is_private), voice=coalesce(p_voice,voice),
    ranked=case when kind='social' then false else coalesce(p_ranked,ranked) end, updated_at=now() where id=p_room; end $$;

-- settings of matchmade rooms (quick / arena / duel) are fixed by the server; only casual / social hosts may edit
create or replace function public.update_room(p_room uuid, p_settings jsonb, p_name text default null) returns void language plpgsql security definer set search_path=public as $$
begin update rooms set settings=coalesce(p_settings,settings), name=coalesce(nullif(trim(p_name),''),name), updated_at=now()
  where id=p_room and host=auth.uid() and status='waiting' and kind in ('casual','social') and tournament_match_id is null; end $$;

-- abandon: refunds duel stakes
create or replace function public.abandon_match(p_match uuid) returns void language plpgsql security definer set search_path=public as $$
declare m matches; begin
  select * into m from matches where id=p_match;
  if m.id is null then return; end if;
  if not exists(select 1 from rooms where id=m.room_id and host=auth.uid()) then raise exception 'host only'; end if;
  update matches set status='abandoned', ended_at=now() where id=p_match and status='live';
  if found then
    perform _refund_stakes(p_match);
    update tournament_matches set status='ready' where id=m.tournament_match_id and status='live';
  end if;
  update rooms set status='waiting', current_match=null, updated_at=now() where id=m.room_id and current_match=p_match;
  update room_players set ready=false where room_id=m.room_id; end $$;

-- ============ RESULTS v3 (duel prizes, challenges, ready reset) ============
create or replace function public.report_match(p_match uuid, p_score_a int, p_score_b int, p_duration int default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m matches; r rooms; w smallint; u uuid; ra int; rb int; ex numeric; k int := 32; d int; res int; my int; opp int; s record; prize int := 0; begin
  select * into m from matches where id=p_match for update;
  if m.id is null or m.status<>'live' then raise exception 'match not live'; end if;
  select * into r from rooms where id=m.room_id;
  if r.host<>auth.uid() then raise exception 'host only'; end if;
  if p_score_a<0 or p_score_b<0 or p_score_a>30 or p_score_b>30 then raise exception 'bad score'; end if;
  w := case when p_score_a>p_score_b then 0 when p_score_b>p_score_a then 1 else -1 end;
  select avg(rating)::int into ra from profiles where id = any(m.team_a);
  select avg(rating)::int into rb from profiles where id = any(m.team_b);
  ex := 1/(1+power(10,(rb-ra)/400.0));
  d := round(k*((case w when 0 then 1 when 1 then 0 else 0.5 end) - ex));
  update matches set score_a=p_score_a, score_b=p_score_b, winner=w, status='done', ended_at=now(),
    duration_s=coalesce(p_duration, extract(epoch from now()-started_at)::int) where id=p_match;
  for u, res, my, opp in
    select x, case w when 0 then 1 when 1 then -1 else 0 end, p_score_a, p_score_b from unnest(m.team_a) x
    union all select x, case w when 1 then 1 when 0 then -1 else 0 end, p_score_b, p_score_a from unnest(m.team_b) x
  loop
    perform _grant(u, 40 + res*30 + 10 + my*5, case when r.kind='duel' then 0 else 50 + (res=1)::int*100 end,
      case when m.ranked then (case when u = any(m.team_a) then d else -d end) else 0 end, res, my, 'match', p_match);
    update profiles set win_streak = case when res=1 then win_streak+1 else 0 end,
      best_streak = greatest(best_streak, case when res=1 then win_streak+1 else 0 end),
      arena_points = case when r.kind='arena' then greatest(0, arena_points + case res when 1 then 30 + least(win_streak,5)*5 when 0 then 5 else -20 end) else arena_points end
    where id=u;
    perform _progress(u,'play_online',1);
    perform _progress(u,'goals',my);
    if res=1 then perform _progress(u,'win_online',1); end if;
    if res=1 and r.kind='arena' then perform _progress(u,'win_arena',1); end if;
    if r.kind='quick' then perform _progress(u,'play_quick',1); end if;
    if r.kind='duel' then perform _progress(u,'play_duel',1); if res=1 then perform _progress(u,'win_duel',1); end if; end if;
    if res=1 and opp=0 then perform _progress(u,'clean_sheet',1); end if;
    if res=1 and my-opp >= 3 then perform _progress(u,'big_win',1); end if;
    if m.mode='2v2' then perform _progress(u,'play_2v2',1); elsif m.mode='3v3' then perform _progress(u,'play_3v3',1); end if;
    if m.tournament_match_id is not null then perform _progress(u,'play_tournament',1); end if;
    perform _progress(u,'streak',(select win_streak from profiles where id=u));
  end loop;
  -- duel stakes: winners get the tier prize, losers lose the entry; a draw refunds everyone
  if r.kind='duel' then
    if w = -1 then perform _refund_stakes(p_match);
    else
      for s in select st.*, t.prize as tprize from arena_stakes st join arena_tiers t on t.id=st.tier where st.match_id=p_match and st.status='held' for update of st loop
        if (w=0 and s.user_id = any(m.team_a)) or (w=1 and s.user_id = any(m.team_b)) then
          if s.currency='gems' then update profiles set gems=gems+s.tprize where id=s.user_id; else update profiles set coins=coins+s.tprize where id=s.user_id; end if;
          update arena_stakes set status='paid', prize=s.tprize, settled_at=now() where match_id=p_match and user_id=s.user_id;
          prize := s.tprize;
        else update arena_stakes set status='lost', settled_at=now() where match_id=p_match and user_id=s.user_id; end if;
      end loop;
    end if;
  end if;
  if m.tournament_match_id is not null then perform _tm_result(m.tournament_match_id, p_score_a, p_score_b); end if;
  update rooms set status='waiting', current_match=null, updated_at=now() where id=m.room_id;
  -- everyone re-confirms (rematch) — matchmade rooms no longer auto-restart behind the result screen
  update room_players set ready=false where room_id=m.room_id;
  return jsonb_build_object('winner',w,'rating_delta',d,'prize',prize,'tier',r.tier); end $$;

-- ============ TOURNAMENTS: rewards are gems only (≤30; World Cup 500) ============
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check check (format in ('single_elim','double_elim','round_robin','swiss','league','world_cup'));
alter table public.tournaments drop constraint if exists tournaments_prize_gems_check;
alter table public.tournaments add constraint tournaments_prize_gems_check check ((prize_gems between 0 and 30) or (format='world_cup' and prize_gems=500));
alter table public.tournaments add column if not exists month date;
alter table public.tournaments add column if not exists stage text;
create unique index if not exists tournaments_wc_month on public.tournaments(month) where format='world_cup';
alter table public.tournament_matches drop constraint if exists tournament_matches_bracket_check;
alter table public.tournament_matches add constraint tournament_matches_bracket_check check (bracket in ('main','winners','losers','final','group'));
alter table public.tournament_matches add column if not exists group_no smallint;
alter table public.tournament_matches add column if not exists deadline timestamptz;
alter table public.tournament_entries add column if not exists group_no smallint;
update public.tournaments set prize_xp=0 where format<>'world_cup' and status<>'finished';

create or replace function public._finish_tournament(p_tid uuid, p_winner uuid) returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; e record; rk int := 0; u uuid; runner uuid; g int; begin
  select * into t from tournaments where id=p_tid;
  if t.status='finished' then return; end if;
  if p_winner is null then
    select id into p_winner from tournament_entries where tournament_id=p_tid order by points desc, (gf-ga) desc, gf desc limit 1;
    for e in select id from tournament_entries where tournament_id=p_tid order by points desc,(gf-ga) desc, gf desc loop
      rk := rk+1; update tournament_entries set final_rank=rk where id=e.id; end loop;
  else update tournament_entries set final_rank=1 where id=p_winner; end if;
  update tournaments set status='finished', winner_entry=p_winner, stage=case when format='world_cup' then 'finished' else stage end where id=p_tid;
  g := case when t.format='world_cup' then 500 else least(t.prize_gems,30) end;
  foreach u in array coalesce((select members from tournament_entries where id=p_winner),'{}') loop
    update profiles set trophies=trophies+1, gems=gems+g where id=u;
  end loop;
  if t.format<>'world_cup' then
    select id into runner from tournament_entries where tournament_id=p_tid and id<>p_winner order by coalesce(final_rank,99), points desc, (gf-ga) desc limit 1;
    if runner is not null then
      update profiles set gems=gems+(g/3) where id in (select unnest(members) from tournament_entries where id=runner);
    end if;
  end if;
end $$;

-- ============ MONTHLY RANKING ============
create or replace function public.monthly_ranking(p_month date default null, p_limit int default 100)
returns table(user_id uuid, username text, avatar text, avatar_url text, level int, rating int, points int, wins int, draws int, losses int, played int, gd int, rank int)
language sql stable security definer set search_path=public as $$
  with mon as (select coalesce(p_month, date_trunc('month', now() at time zone 'Asia/Tehran')::date) m),
  rows as (
    select x as uid, case when mt.winner=0 then 1 when mt.winner=1 then -1 else 0 end res, mt.score_a - mt.score_b diff
      from matches mt, unnest(mt.team_a) x, mon where mt.status='done' and (mt.ended_at at time zone 'Asia/Tehran')::date >= mon.m and (mt.ended_at at time zone 'Asia/Tehran')::date < (mon.m + interval '1 month')::date
    union all
    select x, case when mt.winner=1 then 1 when mt.winner=0 then -1 else 0 end, mt.score_b - mt.score_a
      from matches mt, unnest(mt.team_b) x, mon where mt.status='done' and (mt.ended_at at time zone 'Asia/Tehran')::date >= mon.m and (mt.ended_at at time zone 'Asia/Tehran')::date < (mon.m + interval '1 month')::date
  ), agg as (
    select uid, sum(case res when 1 then 3 when 0 then 1 else 0 end)::int pts, count(*) filter (where res=1)::int w, count(*) filter (where res=0)::int dr,
      count(*) filter (where res=-1)::int l, count(*)::int pl, sum(diff)::int gd from rows group by uid
  )
  select p.id, p.username, p.avatar, p.avatar_url, p.level, p.rating, a.pts, a.w, a.dr, a.l, a.pl, a.gd,
    (rank() over (order by a.pts desc, a.w desc, a.gd desc, p.rating desc))::int
  from agg a join profiles p on p.id=a.uid order by 13 limit greatest(1, least(p_limit, 500));
$$;

-- ============ WORLD CUP ============
-- group stage: 3 rounds inside each group of 4; then top-2 of every group → single-elimination to the final
create or replace function public._wc_knockout(p_tid uuid) returns void language plpgsql security definer set search_path=public as $$
declare ng int; q int; rounds int; r int; i int; m record; nxt uuid; w uuid[]; ru uuid[]; g int; e uuid; mid uuid; begin
  if exists(select 1 from tournament_matches where tournament_id=p_tid and bracket='main') then return; end if;
  select max(group_no)+1 into ng from tournament_entries where tournament_id=p_tid;
  w := array_fill(null::uuid, array[ng]); ru := array_fill(null::uuid, array[ng]);
  for g in 0..ng-1 loop
    i := 0;
    for e in select id from tournament_entries where tournament_id=p_tid and group_no=g order by points desc, (gf-ga) desc, gf desc, seed loop
      if i=0 then w[g+1] := e; elsif i=1 then ru[g+1] := e; else update tournament_entries set eliminated=true where id=e; end if;
      i := i+1;
    end loop;
  end loop;
  q := ng*2; rounds := round(ln(q)/ln(2));
  for r in 1..rounds loop
    for i in 0..(q/(2^r)::int)-1 loop
      insert into tournament_matches(tournament_id,bracket,round,idx,deadline) values (p_tid,'main',r,i, case when r=1 then now()+interval '2 days' end);
    end loop;
  end loop;
  for m in select * from tournament_matches where tournament_id=p_tid and bracket='main' and round<rounds loop
    select id into nxt from tournament_matches where tournament_id=p_tid and bracket='main' and round=m.round+1 and idx=m.idx/2;
    update tournament_matches set next_match=nxt, next_slot=(m.idx%2) where id=m.id;
  end loop;
  -- pairs of groups (2j, 2j+1): winner A vs runner-up B, winner B vs runner-up A
  for i in 0..ng-1 loop
    select id into mid from tournament_matches where tournament_id=p_tid and bracket='main' and round=1 and idx=i;
    if i%2=0 then update tournament_matches set entry_a=w[i+1], entry_b=ru[i+2], status='ready' where id=mid;
    else update tournament_matches set entry_a=w[i+1], entry_b=ru[i], status='ready' where id=mid; end if;
  end loop;
  update tournaments set stage='knockout', current_round=1 where id=p_tid;
end $$;

create or replace function public._wc_seed(p_tid uuid) returns void language plpgsql security definer set search_path=public as $$
declare t tournaments; ids uuid[]; n int; size int; ng int; s int; pot int; pos int; g int; grp uuid[]; mid uuid; begin
  select * into t from tournaments where id=p_tid for update;
  if t.status<>'registration' then return; end if;
  -- top of this month's ranking, then (if fewer than 64 played this month) highest rated players
  select array_agg(uid order by ord) into ids from (
    select uid, min(ord) ord from (
      select mr.user_id uid, mr.rank::bigint ord from monthly_ranking(t.month, 64) mr
      union all
      select p.id, 100000 + row_number() over (order by p.rating desc, p.xp desc) from profiles p
    ) z group by uid order by min(ord) limit 64) y;
  n := coalesce(array_length(ids,1),0);
  size := case when n>=64 then 64 when n>=32 then 32 when n>=16 then 16 when n>=8 then 8 else 0 end;
  if size = 0 then update tournaments set starts_at=now()+interval '1 day' where id=p_tid; return; end if;
  ng := size/4;
  for s in 1..size loop
    pot := (s-1)/ng; pos := (s-1)%ng; g := case when pot%2=0 then pos else ng-1-pos end;
    insert into tournament_entries(tournament_id,captain,team_name,members,seed,group_no)
      select p_tid, ids[s], p.username, array[ids[s]], s, g from profiles p where p.id=ids[s];
  end loop;
  for g in 0..ng-1 loop
    select array_agg(id order by seed) into grp from tournament_entries where tournament_id=p_tid and group_no=g;
    insert into tournament_matches(tournament_id,bracket,round,idx,group_no,entry_a,entry_b,status,deadline) values
      (p_tid,'group',1,g*2,g,grp[1],grp[2],'ready',now()+interval '2 days'),(p_tid,'group',1,g*2+1,g,grp[3],grp[4],'ready',now()+interval '2 days'),
      (p_tid,'group',2,g*2,g,grp[1],grp[3],'ready',now()+interval '4 days'),(p_tid,'group',2,g*2+1,g,grp[2],grp[4],'ready',now()+interval '4 days'),
      (p_tid,'group',3,g*2,g,grp[1],grp[4],'ready',now()+interval '6 days'),(p_tid,'group',3,g*2+1,g,grp[2],grp[3],'ready',now()+interval '6 days');
  end loop;
  update tournaments set status='running', stage='groups', current_round=1, max_entries=size where id=p_tid;
end $$;

-- creates this month's cup, seeds it on the 25th (Tehran), forfeits overdue matches; idempotent (pg_cron hourly + clients)
create or replace function public.wc_tick() returns public.tournaments language plpgsql security definer set search_path=public as $$
declare m date := date_trunc('month', now() at time zone 'Asia/Tehran')::date; t tournaments; x record;
  mon text[] := array['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند']; begin
  perform pg_advisory_xact_lock(hashtext('nexora-wc'));
  insert into tournaments(name,format,mode,max_entries,status,created_by,prize_xp,prize_coins,prize_gems,starts_at,month,stage)
  values ('جام جهانی NEXORA · '||to_char(m,'YYYY-MM'),'world_cup','1v1',64,'registration',null,0,0,500,
          (m + 24)::timestamp at time zone 'Asia/Tehran', m, 'qualifying')
  on conflict do nothing;
  select * into t from tournaments where format='world_cup' and month=m;
  if t.status='registration' and now() >= t.starts_at then perform _wc_seed(t.id); end if;
  -- every playable cup match gets a deadline; overdue ones are decided (group: 0-0, knockout: higher seed advances)
  update tournament_matches tm set deadline=now()+interval '2 days' from tournaments tt
    where tt.id=tm.tournament_id and tt.format='world_cup' and tm.status='ready' and tm.deadline is null;
  for x in select tm.id from tournament_matches tm join tournaments tt on tt.id=tm.tournament_id
     where tt.format='world_cup' and tt.status='running' and tm.status in ('ready','live') and tm.deadline < now() - case when tm.status='live' then interval '1 hour' else interval '0' end
     order by tm.bracket desc, tm.round, tm.idx loop
    if exists(select 1 from tournament_matches where id=x.id and status in ('ready','live')) then
      update tournament_matches set status='ready' where id=x.id;
      perform _tm_result(x.id, 0, 0);
    end if;
  end loop;
  select * into t from tournaments where format='world_cup' and month=m;
  return t; end $$;

-- _tm_result v3: group stage aware
create or replace function public._tm_result(p_tm uuid, sa int, sb int) returns void language plpgsql security definer set search_path=public as $$
declare tm tournament_matches; t tournaments; win uuid; los uuid; begin
  select * into tm from tournament_matches where id=p_tm for update;
  if tm.status in ('done','bye') then return; end if;
  select * into t from tournaments where id=tm.tournament_id;
  update tournament_matches set score_a=sa, score_b=sb, status='done' where id=p_tm;
  update tournament_entries set played=played+1, gf=gf+sa, ga=ga+sb, wins=wins+(sa>sb)::int, draws=draws+(sa=sb)::int, losses=losses+(sa<sb)::int,
    points=points+case when sa>sb then 3 when sa=sb then 1 else 0 end where id=tm.entry_a;
  update tournament_entries set played=played+1, gf=gf+sb, ga=ga+sa, wins=wins+(sb>sa)::int, draws=draws+(sa=sb)::int, losses=losses+(sb<sa)::int,
    points=points+case when sb>sa then 3 when sa=sb then 1 else 0 end where id=tm.entry_b;

  if tm.bracket='group' then
    update tournament_matches set winner_entry=case when sa>sb then tm.entry_a when sb>sa then tm.entry_b end where id=p_tm;
    if not exists(select 1 from tournament_matches where tournament_id=t.id and bracket='group' and round=tm.round and status in ('pending','ready','live')) then
      update tournaments set current_round=greatest(current_round, tm.round+1) where id=t.id;
    end if;
    if not exists(select 1 from tournament_matches where tournament_id=t.id and bracket='group' and status in ('pending','ready','live')) then
      perform _wc_knockout(t.id);
    end if;
    return;
  end if;

  if t.format in ('round_robin','league','swiss') then
    if not exists(select 1 from tournament_matches where tournament_id=t.id and status in ('pending','ready','live')) then
      if t.format='swiss' and t.current_round < t.rounds then perform _swiss_round(t.id, t.current_round+1);
      else perform _finish_tournament(t.id, null); end if;
    end if; return;
  end if;

  -- knockout: draw → team A advances (higher seed); online knockout games use golden goal so draws are rare
  if sa>=sb then win:=tm.entry_a; los:=tm.entry_b; else win:=tm.entry_b; los:=tm.entry_a; end if;
  update tournament_matches set winner_entry=win where id=p_tm;
  if tm.bracket='final' then perform _finish_tournament(t.id, win); return; end if;
  if tm.loser_next is not null then perform _tm_place(tm.loser_next, tm.loser_slot, los); perform _resolve_byes(t.id);
  else update tournament_entries set eliminated=true where id=los; end if;
  if tm.next_match is null then perform _finish_tournament(t.id, win); return; end if;
  perform _tm_place(tm.next_match, tm.next_slot, win);
  perform _resolve_byes(t.id);
  update tournaments set current_round=greatest(current_round, tm.round+1) where id=t.id;
end $$;

-- custom tournaments: no XP/coin prizes any more (gems only)
create or replace function public.create_tournament(p_name text, p_format text, p_mode text default '1v1', p_max int default 16,
  p_rounds int default null, p_prize_gems int default 20, p_starts timestamptz default null, p_min_level int default 1)
returns public.tournaments language plpgsql security definer set search_path=public as $$
declare t tournaments; begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_format not in ('single_elim','double_elim','round_robin','swiss','league') then raise exception 'bad format'; end if;
  if p_max not in (4,8,16,32,64) then raise exception 'bad size'; end if;
  insert into tournaments(name,format,mode,max_entries,rounds,created_by,prize_xp,prize_coins,prize_gems,starts_at,min_level)
  values (p_name,p_format,p_mode,p_max,p_rounds,auth.uid(),0,0,least(greatest(coalesce(p_prize_gems,20),0),30),p_starts,greatest(p_min_level,1)) returning * into t;
  return t; end $$;

-- ============ DISC PACKS (130–300 gems) ============
create table if not exists public.disc_packs (
  id text primary key, name_fa text not null, price_gems int not null check (price_gems between 130 and 300),
  discs text[] not null, sort int not null default 0
);
alter table public.disc_packs enable row level security;
drop policy if exists "read" on public.disc_packs;
create policy "read" on public.disc_packs for select using (true);
revoke insert, update, delete on public.disc_packs from authenticated, anon;
insert into public.disc_packs(id,name_fa,price_gems,discs,sort)
select v.id, v.name_fa, v.price, array(select d.id from public.discs d where d.cat=v.cat and d.price_gems>0 order by d.id limit v.lim), v.sort
from (values ('pack_spt','بسته‌ی ورزشی (۴ دیسک)','spt',4,130,1),('pack_lux','بسته‌ی لوکس (۴ دیسک)','lux',4,170,2),('pack_car','بسته‌ی خودرو (۵ دیسک)','car',5,200,3),
             ('pack_elite','بسته‌ی الیت (۶ دیسک)','elite',6,220,4),('pack_emb','بسته‌ی نشان‌ها (۴ دیسک)','emb',4,260,5),('pack_chrome','بسته‌ی کروم (۴ دیسک)','chrome',4,280,6),
             ('pack_leg','بسته‌ی افسانه‌ها (۲ دیسک)','leg',2,300,7)) as v(id,name_fa,cat,lim,price,sort)
on conflict (id) do update set name_fa=excluded.name_fa, price_gems=excluded.price_gems, discs=excluded.discs, sort=excluded.sort;

create or replace function public.buy_pack(p_pack text) returns int language plpgsql security definer set search_path=public as $$
declare pk disc_packs; g int; begin
  select * into pk from disc_packs where id=p_pack; if pk.id is null then raise exception 'pack not found'; end if;
  if not exists(select 1 from unnest(pk.discs) x where not exists(select 1 from inventory i where i.user_id=auth.uid() and i.disc_id=x)) then raise exception 'already owned'; end if;
  update profiles set gems=gems-pk.price_gems where id=auth.uid() and gems>=pk.price_gems returning gems into g;
  if g is null then raise exception 'not enough gems'; end if;
  insert into inventory(user_id,disc_id) select auth.uid(), x from unnest(pk.discs) x on conflict do nothing;
  return g; end $$;

-- ============ DAILY CHALLENGES: more variety, distinct kinds per day ============
insert into public.challenge_defs values
 ('quick2','دو مسابقه‌ی سریع انجام بده','play_quick',2,2,80),
 ('duel1','در یکی از آرناهای دوئل شرکت کن','play_duel',1,3,100),
 ('duelwin','یک دوئل آرنا ببر','win_duel',1,5,180),
 ('big1','با اختلاف ۳ گل یا بیشتر ببر','big_win',1,4,150),
 ('follow1','یک بازیکن را دنبال کن','social_follow',1,1,30),
 ('msg3','سه پیام در گفتگوها بفرست','send_message',3,1,30),
 ('club1','عضو یک باشگاه شو','join_club',1,2,60),
 ('bot1','یک بار ربات را شکست بده','win_bot',1,1,40),
 ('goals3','سه گل در بازی‌های آنلاین بزن','goals',3,2,70),
 ('play5','پنج بازی آنلاین انجام بده','play_online',5,3,140),
 ('tchal','در یک چالش باشگاهی بازی کن','play_club_challenge',1,3,120)
on conflict (id) do nothing;

create or replace function public.get_daily_challenges() returns setof public.user_challenges language plpgsql security definer set search_path=public as $$
declare d date := (now() at time zone 'Asia/Tehran')::date; begin
  if not exists(select 1 from user_challenges where user_id=auth.uid() and day=d) then
    insert into user_challenges(user_id,day,def_id)
    select auth.uid(), d, id from (
      select distinct on (kind) id, md5(id || d::text || auth.uid()::text) h from challenge_defs order by kind, md5(id || d::text || auth.uid()::text)
    ) x order by h limit 5;
  end if;
  return query select * from user_challenges where user_id=auth.uid() and day=d order by def_id; end $$;

create or replace function public._ch_follow() returns trigger language plpgsql security definer set search_path=public as $$
begin perform _progress(new.follower,'social_follow',1); return new; end $$;
drop trigger if exists ch_follow on public.follows;
create trigger ch_follow after insert on public.follows for each row execute function public._ch_follow();
create or replace function public._ch_message() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.sender is not null then perform _progress(new.sender,'send_message',1); end if; return new; end $$;
drop trigger if exists ch_message on public.messages;
create trigger ch_message after insert on public.messages for each row execute function public._ch_message();
create or replace function public._ch_club() returns trigger language plpgsql security definer set search_path=public as $$
begin perform _progress(new.user_id,'join_club',1); return new; end $$;
drop trigger if exists ch_club on public.club_members;
create trigger ch_club after insert on public.club_members for each row execute function public._ch_club();

-- ============ CLUB TEAM CHALLENGES ============
create table if not exists public.club_challenges (
  id uuid primary key default gen_random_uuid(),
  from_club uuid not null references public.clubs(id) on delete cascade,
  to_club uuid not null references public.clubs(id) on delete cascade,
  mode text not null check (mode in ('1v1','2v2','3v3')),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null, room_code text,
  created_at timestamptz not null default now(), check (from_club<>to_club)
);
alter table public.club_challenges enable row level security;
drop policy if exists "read" on public.club_challenges;
create policy "read" on public.club_challenges for select to authenticated using (
  exists(select 1 from public.club_members m where m.user_id=auth.uid() and m.club_id in (from_club,to_club)));
revoke insert, update, delete on public.club_challenges from authenticated, anon;

create or replace function public.club_challenge(p_to_club uuid, p_mode text default '3v3') returns uuid language plpgsql security definer set search_path=public as $$
declare my club_members; cid uuid; cv uuid; tg text; begin
  select * into my from club_members where user_id=auth.uid();
  if my.club_id is null then raise exception 'club not found'; end if;
  if my.role not in ('leader','officer') then raise exception 'officer only'; end if;
  if p_to_club=my.club_id or not exists(select 1 from clubs where id=p_to_club) then raise exception 'club not found'; end if;
  if exists(select 1 from club_challenges where from_club=my.club_id and to_club=p_to_club and status='pending') then raise exception 'already joined'; end if;
  insert into club_challenges(from_club,to_club,mode,created_by) values (my.club_id,p_to_club,p_mode,auth.uid()) returning id into cid;
  select tag into tg from clubs where id=my.club_id;
  select conversation_id into cv from clubs where id=p_to_club;
  if cv is not null then insert into messages(conversation_id,sender,body) values (cv,null,'⚔️ باشگاه ['||tg||'] شما را به یک چالش '||p_mode||' دعوت کرد. افسران می‌توانند از صفحه‌ی باشگاه بپذیرند.'); end if;
  return cid; end $$;

create or replace function public.club_challenge_respond(p_id uuid, p_accept boolean) returns public.rooms language plpgsql security definer set search_path=public as $$
declare ch club_challenges; r rooms; ta text; tb text; cv uuid; begin
  select * into ch from club_challenges where id=p_id for update;
  if ch.id is null or ch.status<>'pending' then raise exception 'request not found'; end if;
  if coalesce(_club_role(ch.to_club),'member') not in ('leader','officer') and not (not p_accept and coalesce(_club_role(ch.from_club),'member') in ('leader','officer')) then
    raise exception 'officer only'; end if;
  if not p_accept then
    update club_challenges set status=case when _club_role(ch.from_club) is not null then 'cancelled' else 'declined' end where id=p_id; return null; end if;
  select tag into ta from clubs where id=ch.from_club; select tag into tb from clubs where id=ch.to_club;
  r := create_room(ch.mode, '⚔️ '||ta||' vs '||tb, true, false, true, '{"goals":3,"time":300,"field":6,"turn":15}'::jsonb, 'casual');
  update club_challenges set status='accepted', room_id=r.id, room_code=r.code where id=p_id;
  for cv in select conversation_id from clubs where id in (ch.from_club, ch.to_club) and conversation_id is not null loop
    insert into messages(conversation_id,sender,body) values (cv,null,'⚔️ چالش '||ta||' و '||tb||' پذیرفته شد! کد اتاق: '||r.code);
  end loop;
  return r; end $$;

-- room players of a club challenge get the challenge progress when that room plays a match
create or replace function public._ch_clubmatch() returns trigger language plpgsql security definer set search_path=public as $$
declare u uuid; begin
  if new.status='done' and old.status='live' and exists(select 1 from club_challenges where room_id=new.room_id) then
    foreach u in array new.team_a || new.team_b loop perform _progress(u,'play_club_challenge',1); end loop;
  end if; return new; end $$;
drop trigger if exists ch_clubmatch on public.matches;
create trigger ch_clubmatch after update of status on public.matches for each row execute function public._ch_clubmatch();

-- ============ STORAGE: avatar update must stay in own folder ============
drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ VIEWS ============
drop view if exists public.room_list;
create view public.room_list with (security_invoker=on) as
select r.id, r.code, r.name, r.mode, r.kind, r.tier, r.status, r.is_private, r.ranked, r.voice, r.settings, r.created_at, r.host,
  h.username as host_name, h.avatar as host_avatar, h.avatar_url as host_avatar_url, h.level as host_level, h.league as host_league,
  (select count(*) from public.room_players p where p.room_id=r.id and p.role='player')::int as players,
  (select count(*) from public.room_players p where p.room_id=r.id and p.role='spectator')::int as spectators,
  public.room_size(r.mode)*2 as capacity
from public.rooms r join public.profiles h on h.id=r.host
where not r.is_private and r.updated_at > now() - interval '2 hours';
grant select on public.room_list to authenticated;

-- ============ GRANTS / REALTIME / CRON ============
grant execute on all functions in schema public to authenticated;
revoke execute on function public._grant, public._tm_result, public._tm_place, public._finish_tournament, public._rr_schedule,
  public._swiss_round, public._autoseat, public._gen_code, public._resolve_byes, public._progress, public._sweep_rooms,
  public._club_add, public._start_match, public._matchmake, public._refund_stakes, public._wc_seed, public._wc_knockout,
  public._ch_follow, public._ch_message, public._ch_club, public._ch_clubmatch from authenticated, anon, public;
do $$ begin
  begin alter publication supabase_realtime add table public.club_challenges; exception when others then null; end;
  begin alter publication supabase_realtime add table public.arena_stakes; exception when others then null; end;
end $$;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('nexora-sweep','nexora-worldcup');
  perform cron.schedule('nexora-sweep', '* * * * *', 'select public._sweep_rooms()');
  perform cron.schedule('nexora-worldcup', '7 * * * *', 'select public.wc_tick()');
end $$;
select public.wc_tick();
