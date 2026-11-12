// Club page: info, join / request / leave, members with roles (kick / promote / demote / transfer),
// recruiting (join requests, invites), club chat and club-vs-club team challenges.
import { xl } from '../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Img, Panel, Press, Segment, T, rowDir, startAlign } from '../ui/kit';
import { C, F, G, fa } from '../ui/theme';
import { buzz, sfx } from '../sound';
import { useAuth } from '../net/auth';
import { Mode, Room, errFa, rpc, supabase } from '../net/supabase';
import { useNav } from '../nav';
import { Avatar, Badge, Empty, Field, Header, S, Spinner, TS, Tabs, discImg } from '../online/ui';
import { isOnline } from './Social';

const ROLE_FA: Record<string, [string, string]> = { leader: ['رهبر', C.gold], officer: ['افسر', C.cyan], member: ['عضو', C.dim] };
const POLICY_FA: Record<string, string> = { open: 'عضوگیری آزاد', request: 'عضویت با درخواست', invite: 'فقط با دعوت' };

export default function Club({ id, onBack, onRoom, toast }: { id: string; onBack: () => void; onRoom: (r: Room) => void; toast: (m: string, k?: string) => void }) {
  const ins = useSafeAreaInsets(); const { uid, profile, refreshProfile } = useAuth(); const nav = useNav();
  const [club, setClub] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [myInvite, setMyInvite] = useState(false);
  const [chals, setChals] = useState<any[]>([]);
  const [tab, setTab] = useState<'members' | 'recruit' | 'chal'>('members');
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('3v3');
  const [q, setQ] = useState(''); const [found, setFound] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [c, m, r, ch] = await Promise.all([
      supabase.from('club_list').select('*').eq('id', id).maybeSingle(),
      supabase.from('club_members').select('user_id, role, joined_at, profiles(username, avatar, avatar_url, level, rating, online_at, equipped_disc)').eq('club_id', id),
      supabase.from('club_requests').select('user_id, kind, message, created_at, profiles(username, avatar, avatar_url, level)').eq('club_id', id),
      supabase.from('club_challenges').select('*, from:clubs!club_challenges_from_club_fkey(name, tag, emblem), to:clubs!club_challenges_to_club_fkey(name, tag, emblem)').or(`from_club.eq.${id},to_club.eq.${id}`).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!c.data) { toast('باشگاه پیدا نشد', 'err'); onBack(); return; }
    setClub(c.data);
    const order = { leader: 0, officer: 1, member: 2 } as Record<string, number>;
    setMembers(((m.data || []) as any[]).sort((a, b) => order[a.role] - order[b.role] || (b.profiles?.rating ?? 0) - (a.profiles?.rating ?? 0)));
    const rs = (r.data || []) as any[]; setReqs(rs.filter(x => x.kind === 'request')); setMyInvite(rs.some(x => x.user_id === uid && x.kind === 'invite'));
    setChals((ch.data || []) as any[]);
  }, [id, uid]);
  useEffect(() => {
    load();
    const chn = supabase.channel(`club:${id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_requests', filter: `club_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_challenges' }, () => load()).subscribe();
    return () => { supabase.removeChannel(chn); };
  }, [load]);
  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, ''); if (term.length < 2) { setFound([]); return; }
    const t = setTimeout(async () => { const { data } = await supabase.from('clubs').select('id, name, tag, emblem').or(`name.ilike.%${term}%,tag.ilike.%${term}%`).neq('id', profile?.club_id || id).limit(10); setFound(data || []); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const run = async (k: string, fn: () => Promise<any>, ok?: string) => {
    if (busy) return; setBusy(k);
    try { const r = await fn(); if (ok) toast(ok, 'ok'); buzz('light'); await load(); refreshProfile(); return r; } catch (e) { toast(errFa(e), 'err'); buzz('heavy'); } finally { setBusy(null); }
  };
  if (!club) return <View style={{ flex: 1 }}><Header title="باشگاه" onBack={onBack} /><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View></View>;

  const mine = members.find(m => m.user_id === uid);
  const officer = mine && (mine.role === 'leader' || mine.role === 'officer');
  const inOther = !!profile?.club_id && profile.club_id !== id;
  const myClubOfficer = !!profile?.club_id && profile.club_id !== id; // challenge from my club (role checked server-side)
  const join = () => run('join', async () => { const r = await rpc<string>('join_club', { p_club: id, p_message: null }); toast(r === 'joined' ? 'به باشگاه پیوستی!' : 'درخواست عضویت فرستاده شد', 'ok'); if (r === 'joined') sfx('win'); });
  const act = (u: string, a: string, ok: string) => run(a + u, () => rpc('club_member_action', { p_club: id, p_user: u, p_action: a }), ok);
  const respond = (c: any, accept: boolean) => run('c' + c.id, async () => { const r = await rpc<Room | null>('club_challenge_respond', { p_id: c.id, p_accept: accept }); if (r && (r as any).id) onRoom(r); }, accept ? 'چالش پذیرفته شد' : 'رد شد');
  const challenge = (to: string) => run('ch' + to, () => rpc('club_challenge', { p_to_club: to, p_mode: mode }), 'چالش فرستاده شد');
  const joinRoom = (code: string) => run('jr', async () => { const r = await rpc<Room>('join_room', { p_code: code }); onRoom(r); });

  return (
    <View style={{ flex: 1 }}>
      <Header title={club.name} en={`CLUB · ${club.tag}`} accent={C.gold} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 76, paddingBottom: ins.bottom + S.xl, paddingHorizontal: S.l }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.hero}>
          <LinearGradient colors={['rgba(255,170,60,.35)', 'rgba(8,12,34,.95)']} style={StyleSheet.absoluteFill} />
          <Img src={discImg(club.emblem)} style={{ width: 88, height: 88 }} />
          <View style={{ flexDirection: rowDir(), alignItems: 'center', marginTop: S.s }}>
            <T s={club.name} style={{ fontFamily: F.title, fontSize: 20 }} /><Badge label={club.tag} color={C.gold} />
          </View>
          {club.description ? <T s={club.description} style={{ fontSize: TS.small, color: '#d6e6ff', textAlign: 'center', marginTop: S.s, paddingHorizontal: S.l }} /> : null}
          <View style={{ flexDirection: rowDir(), marginTop: S.m }}>
            {([['عضو', `${fa(club.members)}/${fa(club.max_members)}`], ['قدرت', fa(club.power)], ['حداقل سطح', fa(club.min_level)]] as const).map(([l, v]) => (
              <View key={l} style={{ alignItems: 'center', width: 90 }}><T s={v} style={{ fontFamily: F.title, fontSize: 15 }} /><T s={l} style={{ fontSize: TS.tiny, color: C.dim }} /></View>
            ))}
          </View>
          <Badge label={POLICY_FA[club.join_policy] || ''} color={C.green} />
        </View>

        {mine ? (
          <View style={{ flexDirection: rowDir(), marginTop: S.m }}>
            <Btn label="گفتگوی باشگاه" small colors={G.primary} onPress={() => club.conversation_id && nav.openChat(club.conversation_id)} style={{ flex: 1, marginLeft: S.s }} />
            <Btn label={busy === 'leave' ? '…' : 'ترک باشگاه'} small colors={G.dark} onPress={() => run('leave', () => rpc('leave_club'), 'از باشگاه خارج شدی')} style={{ flex: 1 }} />
          </View>
        ) : !inOther ? (
          <Btn label={busy === 'join' ? '…' : myInvite ? 'پذیرفتن دعوت' : club.join_policy === 'open' ? 'عضویت' : club.join_policy === 'request' ? 'درخواست عضویت' : 'فقط با دعوت'} colors={G.gold}
            disabled={club.join_policy === 'invite' && !myInvite} onPress={join} style={{ marginTop: S.m }} />
        ) : null}
        {myClubOfficer ? (
          <Panel style={{ padding: S.m, marginTop: S.m }} accent={C.red}>
            <T s="چالش تیمی با این باشگاه (فقط افسران)" style={{ fontFamily: F.bold, fontSize: TS.small, textAlign: 'right', marginBottom: S.s }} />
            <Segment value={mode} onChange={setMode} items={[['1v1', '۱ به ۱'], ['2v2', '۲ به ۲'], ['3v3', '۳ به ۳']]} accent={C.red} />
            <Btn label={busy === 'ch' + id ? '…' : '⚔️ ارسال چالش'} small colors={G.red} onPress={() => challenge(id)} style={{ marginTop: S.s }} />
          </Panel>
        ) : null}

        <View style={{ marginTop: S.l }}>
          <Tabs items={[['members', `اعضا (${fa(members.length)})`], ['recruit', `عضوگیری${reqs.length && officer ? ` (${fa(reqs.length)})` : ''}`], ['chal', 'چالش‌های تیمی']]} value={tab} onChange={setTab} />
        </View>
        <View style={{ marginTop: S.m }}>
          {tab === 'members' ? members.map(m => {
            const [rl, rc] = ROLE_FA[m.role] || ROLE_FA.member;
            return (
              <Press key={m.user_id} onPress={() => nav.openProfile(m.user_id)} scaleTo={.98}>
                <View style={st.row}>
                  <Avatar avatar={m.profiles?.equipped_disc || m.profiles?.avatar} url={m.profiles?.avatar_url} size={40} ring={isOnline(m.profiles?.online_at) ? C.green : C.line} />
                  <View style={{ flex: 1, marginRight: S.s, alignItems: startAlign() }}>
                    <T s={m.profiles?.username || '…'} n={1} style={{ fontFamily: F.bold, fontSize: TS.small }} />
                    <T s={`سطح ${fa(m.profiles?.level ?? 1)} · امتیاز ${fa(m.profiles?.rating ?? 0)}`} style={{ fontSize: TS.tiny, color: C.dim }} />
                  </View>
                  <Badge label={rl} color={rc} />
                  {officer && m.user_id !== uid && (mine.role === 'leader' || m.role === 'member') ? (
                    <View style={{ flexDirection: 'row' }}>
                      {mine.role === 'leader' ? <Press onPress={() => act(m.user_id, m.role === 'officer' ? 'demote' : 'promote', 'نقش تغییر کرد')} style={st.mini}><T s={m.role === 'officer' ? '▼' : '▲'} style={{ color: C.cyan }} /></Press> : null}
                      <Press onPress={() => act(m.user_id, 'kick', 'اخراج شد')} style={st.mini}><T s="✕" style={{ color: C.red }} /></Press>
                    </View>
                  ) : null}
                </View>
              </Press>
            );
          }) : tab === 'recruit' ? (
            !officer ? <Empty title={POLICY_FA[club.join_policy]} sub="درخواست‌ها را افسران باشگاه بررسی می‌کنند" /> :
              reqs.length ? reqs.map(r => (
                <View key={r.user_id} style={st.row}>
                  <Avatar avatar={r.profiles?.avatar} url={r.profiles?.avatar_url} size={40} />
                  <View style={{ flex: 1, marginRight: S.s, alignItems: startAlign() }}>
                    <T s={r.profiles?.username || '…'} style={{ fontFamily: F.bold, fontSize: TS.small }} />
                    {r.message ? <T s={r.message} n={1} style={{ fontSize: TS.tiny, color: C.dim }} /> : null}
                  </View>
                  <Btn label="قبول" small colors={G.green} onPress={() => run('a' + r.user_id, () => rpc('club_decide', { p_club: id, p_user: r.user_id, p_accept: true }), 'عضو جدید!')} style={{ width: 70, marginLeft: 6 }} />
                  <Btn label="رد" small colors={G.dark} onPress={() => run('d' + r.user_id, () => rpc('club_decide', { p_club: id, p_user: r.user_id, p_accept: false }))} style={{ width: 56 }} />
                </View>
              )) : <Empty title="درخواست تازه‌ای نیست" sub="برای دعوت، پروفایل بازیکن را باز کن و «دعوت به باشگاه» را بزن" />
          ) : (
            <View>
              {officer ? (
                <Panel style={{ padding: S.m, marginBottom: S.m }} accent="transparent">
                  <T s="به یک باشگاه دیگر چالش بده" style={{ fontFamily: F.bold, fontSize: TS.small, textAlign: 'right', marginBottom: S.s }} />
                  <Segment value={mode} onChange={setMode} items={[['1v1', '۱ به ۱'], ['2v2', '۲ به ۲'], ['3v3', '۳ به ۳']]} accent={C.red} />
                  <View style={{ marginTop: S.s }}><Field value={q} onChangeText={setQ} placeholder={xl("نام یا تگ باشگاه…")} /></View>
                  {found.map(c => (
                    <View key={c.id} style={st.row}>
                      <Img src={discImg(c.emblem)} style={{ width: 36, height: 36 }} />
                      <T s={`[${c.tag}] ${c.name}`} n={1} style={{ flex: 1, textAlign: 'right', marginRight: S.s, fontFamily: F.bold, fontSize: TS.small }} />
                      <Btn label={busy === 'ch' + c.id ? '…' : '⚔️'} small colors={G.red} onPress={() => challenge(c.id)} style={{ width: 60 }} />
                    </View>
                  ))}
                </Panel>
              ) : null}
              {chals.length ? chals.map(c => {
                const incoming = c.to_club === id;
                const other = incoming ? c.from : c.to;
                return (
                  <View key={c.id} style={st.row}>
                    <Img src={discImg(other?.emblem)} style={{ width: 36, height: 36 }} />
                    <View style={{ flex: 1, marginRight: S.s, alignItems: startAlign() }}>
                      <T s={`${incoming ? 'از' : 'به'} [${other?.tag}] ${other?.name} · ${c.mode}`} n={1} style={{ fontFamily: F.bold, fontSize: TS.small }} />
                      <T s={c.status === 'pending' ? 'در انتظار' : c.status === 'accepted' ? `پذیرفته شد · کد ${c.room_code}` : c.status === 'declined' ? 'رد شد' : 'لغو شد'} style={{ fontSize: TS.tiny, color: c.status === 'accepted' ? C.green : C.dim }} />
                    </View>
                    {c.status === 'pending' && officer && incoming ? <>
                      <Btn label="قبول" small colors={G.green} onPress={() => respond(c, true)} style={{ width: 66, marginLeft: 6 }} />
                      <Btn label="رد" small colors={G.dark} onPress={() => respond(c, false)} style={{ width: 52 }} />
                    </> : c.status === 'pending' && officer ? <Btn label="لغو" small colors={G.dark} onPress={() => respond(c, false)} style={{ width: 60 }} />
                      : c.status === 'accepted' && mine && c.room_code ? <Btn label="ورود" small colors={G.primary} onPress={() => joinRoom(c.room_code)} style={{ width: 66 }} /> : null}
                  </View>
                );
              }) : <Empty title="هنوز چالشی نیست" sub="افسران می‌توانند باشگاه‌های دیگر را به مسابقه دعوت کنند" />}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: 26, overflow: 'hidden', alignItems: 'center', paddingVertical: S.l, borderWidth: 1, borderColor: 'rgba(255,170,60,.5)' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 60, paddingHorizontal: S.s, marginBottom: S.s, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(10,16,44,.86)' },
  mini: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
});
