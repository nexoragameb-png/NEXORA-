-- NEXORA backend v4 (app v2.0.1) — idempotent; safe to re-run after schema.sql, schema_v2.sql, schema_v3.sql.
--  * rooms can actually start: the host of a lobby / club-challenge room may start with empty seats
--    (bots play them, match is unranked); quick / arena searches can switch to a bot match
--    after 20 s; matches.bots marks those games and report_match grants small, rating-free rewards
--  * username_available() for the new sign-up screen
--  * disc catalog replaced by the 31 metallic "NX" discs (18 clubs + 13 national teams), new packs;
--    owners of removed discs are refunded in gems, equipped / avatar / club emblems remapped

-- ============ BOT-FILLED MATCHES ============
alter table public.matches add column if not exists bots boolean not null default false;

drop function if exists public._start_match(uuid);
create or replace function public._start_match(p_room uuid, p_bots boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
declare r rooms; n int; a uuid[]; b uuid[]; mid uuid; tm tournament_matches; tr arena_tiers; u uuid; broke uuid[] := '{}'; bal int; is_full boolean; begin
  select * into r from rooms where id=p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.kind='social' then raise exception 'not allowed'; end if;
  if r.status<>'waiting' then return r.current_match; end if;
  n := room_size(r.mode);
  select coalesce(array_agg(user_id order by slot), '{}') into a from room_players where room_id=p_room and role='player' and team=0;
  select coalesce(array_agg(user_id order by slot), '{}') into b from room_players where room_id=p_room and role='player' and team=1;
  is_full := coalesce(array_length(a,1),0)=n and coalesce(array_length(b,1),0)=n;
  if not is_full then
    -- duels (stakes) and tournament matches always need both sides complete
    if not p_bots or r.kind='duel' or r.tournament_match_id is not null then raise exception 'teams not full'; end if;
    if coalesce(array_length(a,1),0) + coalesce(array_length(b,1),0) = 0 then raise exception 'teams not full'; end if;
  end if;
  if r.kind='duel' then
    select * into tr from arena_tiers where id=r.tier;
    if tr.id is null then raise exception 'bad tier'; end if;
    perform 1 from profiles where id = any(a||b) for update;
    foreach u in array a||b loop
      select case when tr.currency='gems' then gems else coins end into bal from profiles where id=u;
      if coalesce(bal,0) < tr.entry then broke := broke || u; end if;
    end loop;
    if array_length(broke,1) > 0 then
      delete from room_players where room_id=p_room and user_id = any(broke);
      update rooms set updated_at=now() where id=p_room;
      return null;
    end if;
  end if;
  if r.tournament_match_id is not null then select * into tm from tournament_matches where id=r.tournament_match_id; end if;
  insert into matches(room_id,mode,team_a,team_b,ranked,tournament_id,tournament_match_id,bots)
    values (p_room,r.mode,a,b,r.ranked and is_full,tm.tournament_id,r.tournament_match_id,not is_full) returning id into mid;
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

-- auto-seat alternates sides (blue 1, red 1, blue 2, …) so two friends in a 2v2/3v3 lobby face each other
create or replace function public._autoseat(r public.rooms, uid uuid) returns void language plpgsql security definer set search_path=public as $$
declare n int := room_size(r.mode); t smallint; s smallint; begin
  for s in 0..n-1 loop
    for t in 0..1 loop
      if not exists(select 1 from room_players where room_id=r.id and role='player' and team=t and slot=s) then
        update room_players set role='player', team=t, slot=s, ready=false where room_id=r.id and user_id=uid; return; end if;
    end loop;
  end loop;
  update room_players set role='spectator', team=null, slot=null, ready=false where room_id=r.id and user_id=uid;
end $$;

-- host start (lobby / club challenge): seated non-host players must be ready; empty seats → bots
create or replace function public.start_match(p_room uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r rooms; begin
  select * into r from rooms where id=p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.status<>'waiting' then raise exception 'already started'; end if;
  if r.kind in ('quick','arena','duel') then
    if not exists(select 1 from room_players where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'not allowed'; end if;
    if exists(select 1 from room_players where room_id=p_room and role='player' and not ready) then raise exception 'not all ready'; end if;
    return _start_match(p_room, false);
  end if;
  if r.host<>auth.uid() then raise exception 'host only'; end if;
  if not exists(select 1 from room_players where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'take a seat'; end if;
  if exists(select 1 from room_players where room_id=p_room and role='player' and not ready and user_id<>r.host) then raise exception 'not all ready'; end if;
  return _start_match(p_room, true);
end $$;

-- quick / arena search: after 20 s without a full room any seated player may play the bots instead (unranked)
create or replace function public.start_bot_match(p_room uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r rooms; begin
  select * into r from rooms where id=p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.kind not in ('quick','arena') then raise exception 'not allowed'; end if;
  if r.status<>'waiting' then return r.current_match; end if;
  if not exists(select 1 from room_players where room_id=p_room and user_id=auth.uid() and role='player') then raise exception 'not allowed'; end if;
  if r.created_at > now() - interval '20 seconds' and (select count(*) from room_players where room_id=p_room and role='player') < room_size(r.mode)*2 then
    raise exception 'still searching'; end if;
  update room_players set ready=true where room_id=p_room and role='player';
  return _start_match(p_room, true);
end $$;

-- matchmaking (unchanged logic, explicit no-bots start)
create or replace function public._matchmake(p_mode text, p_kind text, p_tier text) returns public.rooms language plpgsql security definer set search_path=public as $$
declare rid uuid; r rooms; my int; tr arena_tiers; cnt int; begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_mode not in ('1v1','2v2','3v3') then raise exception 'bad mode'; end if;
  perform pg_advisory_xact_lock(hashtext('nexora-mm:'||p_mode||':'||p_kind||':'||coalesce(p_tier,'')));
  perform _sweep_rooms();
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
  if cnt = room_size(p_mode)*2 then perform _start_match(r.id, false); end if;
  select * into r from rooms where id=r.id;
  return r; end $$;

-- results: bot games give small, rating-free rewards and do not feed arena points, streaks or challenges
create or replace function public.report_match(p_match uuid, p_score_a int, p_score_b int, p_duration int default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m matches; r rooms; w smallint; u uuid; ra int; rb int; ex numeric; k int := 32; d int := 0; res int; my int; opp int; s record; prize int := 0; begin
  select * into m from matches where id=p_match for update;
  if m.id is null or m.status<>'live' then raise exception 'match not live'; end if;
  select * into r from rooms where id=m.room_id;
  if r.host<>auth.uid() then raise exception 'host only'; end if;
  if p_score_a<0 or p_score_b<0 or p_score_a>30 or p_score_b>30 then raise exception 'bad score'; end if;
  w := case when p_score_a>p_score_b then 0 when p_score_b>p_score_a then 1 else -1 end;
  if not m.bots then
    select avg(rating)::int into ra from profiles where id = any(m.team_a);
    select avg(rating)::int into rb from profiles where id = any(m.team_b);
    ex := 1/(1+power(10,(rb-ra)/400.0));
    d := coalesce(round(k*((case w when 0 then 1 when 1 then 0 else 0.5 end) - ex)), 0);
  end if;
  update matches set score_a=p_score_a, score_b=p_score_b, winner=w, status='done', ended_at=now(),
    duration_s=coalesce(p_duration, extract(epoch from now()-started_at)::int) where id=p_match;
  for u, res, my, opp in
    select x, case w when 0 then 1 when 1 then -1 else 0 end, p_score_a, p_score_b from unnest(m.team_a) x
    union all select x, case w when 1 then 1 when 0 then -1 else 0 end, p_score_b, p_score_a from unnest(m.team_b) x
  loop
    if m.bots then
      perform _grant(u, 15 + res*5 + my*2, 20 + (res=1)::int*20, 0, res, my, 'match_bots', p_match);
      continue;
    end if;
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
  if r.kind='duel' and not m.bots then
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
  update room_players set ready=false where room_id=m.room_id;
  return jsonb_build_object('winner',w,'rating_delta',d,'prize',prize,'tier',r.tier,'bots',m.bots); end $$;


-- ============ SIGN-UP HELPERS ============
create or replace function public.username_available(p_name text) returns boolean language sql stable security definer set search_path=public as
$$ select char_length(trim(p_name)) between 3 and 20 and not exists(select 1 from profiles where lower(username)=lower(trim(p_name))) $$;

-- ============ DISC CATALOG: 31 metallic NX discs ============
-- stage the new catalog
drop table if exists pg_temp._nx;
create temp table _nx(id text primary key, cat text, name text, price_gems int, power smallint, accuracy smallint);
insert into _nx values
 ('club0','club','Real Madrid',0,6,5),('club1','club','Barcelona',260,7,9),('club2','club','Manchester City',280,8,9),('club3','club','Manchester United',200,7,6),
 ('club4','club','Liverpool',240,8,7),('club5','club','Arsenal',220,7,8),('club6','club','Chelsea',190,7,6),('club7','club','Bayern Munich',250,9,7),
 ('club8','club','Borussia Dortmund',160,7,5),('club9','club','Paris Saint-Germain',230,8,7),('club10','club','Inter',200,7,7),('club11','club','AC Milan',180,6,7),
 ('club12','club','Juventus',190,6,8),('club13','club','Al Hilal',0,5,5),('club14','club','Tottenham',150,6,6),('club15','club','Inter Miami',0,5,6),
 ('club16','club','Persepolis',0,6,5),('club17','club','Esteghlal',0,5,6),
 ('nat0','nat','Argentina',300,9,10),('nat1','nat','Brazil',270,9,8),('nat2','nat','France',290,10,8),('nat3','nat','Germany',230,8,8),
 ('nat4','nat','Portugal',220,8,7),('nat5','nat','Spain',260,7,10),('nat6','nat','Italy',190,6,8),('nat7','nat','England',240,8,8),
 ('nat8','nat','Netherlands',170,7,7),('nat9','nat','Belgium',0,6,5),('nat10','nat','Uruguay',0,5,6),('nat11','nat','Croatia',0,5,6),('nat12','nat','Japan',0,4,7);

-- keep ownership safe: anyone who paid gems for a disc whose id is retired or whose identity changed
-- (same id, different team) gets that disc's old gem price back before the row goes
do $$ declare r record; begin
  for r in select i.user_id, sum(d.price_gems) as g from inventory i join discs d on d.id=i.disc_id
           left join _nx n on n.id=d.id where (n.id is null or n.name<>d.name) and d.price_gems>0 group by i.user_id loop
    update profiles set gems = gems + r.g where id=r.user_id;
  end loop;
  delete from inventory i using discs d where d.id=i.disc_id and not exists(select 1 from _nx n where n.id=d.id and n.name=d.name);
end $$;

insert into discs(id,cat,name,price_gems,power,accuracy) select id,cat,name,price_gems,power,accuracy from _nx
on conflict (id) do update set cat=excluded.cat, name=excluded.name, price_gems=excluded.price_gems, power=excluded.power, accuracy=excluded.accuracy;

-- equipped / avatar / room seats / club emblems that point at a retired disc fall back to free club0 (Real Madrid)
update profiles set equipped_disc='club0' where equipped_disc not in (select id from _nx);
update profiles set avatar='club0' where avatar not in (select id from _nx);
update room_players set disc_id=null where disc_id is not null and disc_id not in (select id from _nx);
update clubs set emblem = case when emblem ~ '^emb[0-9]+$' then (select id from _nx order by cat, (regexp_replace(id,'\D','','g'))::int offset (substring(emblem from 4)::int % 31) limit 1) else 'club0' end
  where emblem not in (select id from _nx);
alter table public.profiles alter column equipped_disc set default 'club0';
alter table public.profiles alter column avatar set default 'club0';

-- every user keeps at least the free starters (club0 is always free, so nobody ends up without a usable disc)
delete from disc_packs where id not in ('pack_rising','pack_italia','pack_premier','pack_giants','pack_euro_nat','pack_world');
delete from discs where id not in (select id from _nx);
insert into disc_packs(id,name_fa,price_gems,discs,sort) values
 ('pack_rising','بسته‌ی ستاره‌های نوظهور (۲ دیسک)',130,array['club8','club14'],1),
 ('pack_italia','بسته‌ی سری آ (۳ دیسک)',220,array['club10','club11','club12'],2),
 ('pack_euro_nat','بسته‌ی تیم‌های ملی اروپا (۴ دیسک)',260,array['nat3','nat4','nat6','nat8'],3),
 ('pack_premier','بسته‌ی لیگ برتر (۴ دیسک)',300,array['club3','club4','club5','club6'],4),
 ('pack_giants','بسته‌ی غول‌های اروپا (۳ دیسک)',300,array['club1','club7','club9'],5),
 ('pack_world','بسته‌ی قهرمانان جهان (۳ دیسک)',300,array['nat0','nat1','nat2'],6)
on conflict (id) do update set name_fa=excluded.name_fa, price_gems=excluded.price_gems, discs=excluded.discs, sort=excluded.sort;

create or replace function public.create_club(p_name text, p_tag text, p_emblem text default 'club0', p_desc text default null, p_policy text default 'open', p_min_level int default 1)
returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; cv uuid; begin
  if exists(select 1 from club_members where user_id=auth.uid()) then raise exception 'already in club'; end if;
  update profiles set gems=gems-50 where id=auth.uid() and gems>=50;
  if not found then raise exception 'not enough gems'; end if;
  insert into clubs(name,tag,emblem,description,owner,join_policy,min_level) values (trim(p_name), upper(trim(p_tag)),
    case when exists(select 1 from discs where id=p_emblem) then p_emblem else 'club0' end, p_desc, auth.uid(), p_policy, greatest(p_min_level,1)) returning id into cid;
  insert into conversations(kind,title,owner,club_id) values ('club', trim(p_name), auth.uid(), cid) returning id into cv;
  update clubs set conversation_id=cv where id=cid;
  perform _club_add(cid, auth.uid(), 'leader');
  return cid; end $$;

drop table if exists pg_temp._nx;

-- ============ GRANTS ============
grant execute on function public.start_match(uuid), public.start_bot_match(uuid), public.report_match(uuid,int,int,int), public.create_club(text,text,text,text,text,int) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
revoke execute on function public._start_match(uuid, boolean), public._matchmake(text,text,text), public._autoseat(public.rooms, uuid) from anon, authenticated, public;
revoke execute on function public.start_bot_match(uuid) from anon, public;
