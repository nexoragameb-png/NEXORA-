// Public player profile: stats, follow / unfollow, private message, block, club invite.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI } from '../game/assets';
import { Btn, Img, Panel, T, rowDir, startAlign } from '../ui/kit';
import { C, F, G, fa } from '../ui/theme';
import { buzz } from '../sound';
import { useAuth } from '../net/auth';
import { OnlineProfile, errFa, rpc, supabase } from '../net/supabase';
import { discStats } from '../net/discs';
import { useNav } from '../nav';
import { Avatar, Badge, Header, LEAGUE_IMG, S, Spinner, StatBars, TS, useLeagues } from '../online/ui';
import { isOnline, timeAgo } from './Social';

export default function UserProfile({ id, onBack, toast }: { id: string; onBack: () => void; toast: (m: string, k?: string) => void }) {
  const ins = useSafeAreaInsets(); const { uid, profile: me } = useAuth(); const nav = useNav(); const leagues = useLeagues();
  const [p, setP] = useState<OnlineProfile | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [follows, setFollows] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [club, setClub] = useState<{ name: string; tag: string } | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [pr, ps, f, b] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('profile_stats').select('*').eq('id', id).maybeSingle(),
      supabase.from('follows').select('follower').eq('follower', uid!).eq('followee', id).maybeSingle(),
      supabase.from('user_blocks').select('blocked').eq('blocker', uid!).eq('blocked', id).maybeSingle(),
    ]);
    if (!pr.data) { toast('بازیکن پیدا نشد', 'err'); onBack(); return; }
    setP(pr.data as OnlineProfile); setStats({ followers: ps.data?.followers ?? 0, following: ps.data?.following ?? 0 });
    setFollows(!!f.data); setBlocked(!!b.data);
    if ((pr.data as any).club_id) { const { data } = await supabase.from('clubs').select('name, tag').eq('id', (pr.data as any).club_id).maybeSingle(); setClub(data as any); } else setClub(null);
    if (me?.club_id) { const { data } = await supabase.from('club_members').select('role').eq('user_id', uid!).maybeSingle(); setMyRole((data as any)?.role ?? null); }
  }, [id, uid, me?.club_id]);
  useEffect(() => { load(); }, [load]);

  const run = async (k: string, fn: () => Promise<any>, ok?: string) => {
    if (busy) return; setBusy(k);
    try { await fn(); if (ok) toast(ok, 'ok'); buzz('light'); await load(); } catch (e) { toast(errFa(e), 'err'); } finally { setBusy(null); }
  };
  const follow = () => run('f', async () => {
    const r = follows ? await supabase.from('follows').delete().eq('follower', uid!).eq('followee', id) : await supabase.from('follows').insert({ follower: uid, followee: id });
    if (r.error) throw r.error;
  }, follows ? 'دنبال نمی‌کنی' : 'دنبال شد');
  const block = () => run('b', async () => {
    const r = blocked ? await supabase.from('user_blocks').delete().eq('blocker', uid!).eq('blocked', id) : await supabase.from('user_blocks').insert({ blocker: uid, blocked: id });
    if (r.error) throw r.error;
  }, blocked ? 'از مسدودی خارج شد' : 'مسدود شد');
  const dm = () => run('m', async () => { const cid = await rpc<string>('open_dm', { p_user: id }); nav.openChat(cid); });
  const invite = () => run('i', () => rpc('club_invite', { p_club: me!.club_id, p_user: id }), 'دعوت باشگاه فرستاده شد');

  if (!p) return <View style={{ flex: 1 }}><Header title="پروفایل" onBack={onBack} /><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View></View>;
  const lg = leagues?.find(l => l.id === p.league);
  const total = p.wins + p.losses + p.draws, wr = total ? Math.round(p.wins / total * 100) : 0;
  const self = p.id === uid;
  return (
    <View style={{ flex: 1 }}>
      <Header title={p.username} en="PLAYER PROFILE" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 76, paddingBottom: ins.bottom + S.xl, paddingHorizontal: S.l }} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <LinearGradient colors={[(lg?.color || C.cyan) + '55', 'rgba(8,12,34,.95)']} style={StyleSheet.absoluteFill} />
          <Avatar avatar={p.equipped_disc || p.avatar} url={p.avatar_url} size={96} ring={isOnline(p.online_at) ? C.green : lg?.color || C.cyan} />
          <T s={p.username} style={{ fontFamily: F.title, fontSize: 22, marginTop: S.s }} />
          <T s={isOnline(p.online_at) ? 'آنلاین' : `آخرین بازدید ${timeAgo(p.online_at)} پیش`} style={{ fontSize: TS.cap, color: isOnline(p.online_at) ? C.green : C.dim }} />
          {p.bio ? <T s={p.bio} style={{ fontSize: TS.small, color: '#d6e6ff', textAlign: 'center', marginTop: S.s, paddingHorizontal: S.l }} /> : null}
          <View style={{ flexDirection: rowDir(), marginTop: S.s, flexWrap: 'wrap', justifyContent: 'center', rowGap: 4 }}>
            <Badge label={`سطح ${fa(p.level)}`} color={C.gold} />
            <Badge label={lg?.name_fa || p.league} color={lg?.color || C.cyan} />
            {club ? <Badge label={`[${club.tag}] ${club.name}`} color={C.orange} /> : null}
          </View>
          <View style={{ flexDirection: rowDir(), marginTop: S.m }}>
            {([['دنبال‌کننده', stats.followers], ['دنبال‌شده', stats.following], ['امتیاز', p.rating], ['آرنا', p.arena_points]] as const).map(([l, v]) => (
              <View key={l} style={{ alignItems: 'center', width: 76 }}><T s={fa(v)} style={{ fontFamily: F.title, fontSize: 16 }} /><T s={l} style={{ fontSize: TS.tiny, color: C.dim }} /></View>
            ))}
          </View>
        </View>
        {!self ? (
          <View style={{ flexDirection: rowDir(), marginTop: S.m }}>
            <Btn label={busy === 'f' ? '…' : follows ? 'دنبال می‌کنی ✓' : 'دنبال کردن'} small colors={follows ? G.dark : G.primary} onPress={follow} style={{ flex: 1, marginLeft: S.s }} />
            <Btn label={busy === 'm' ? '…' : 'پیام خصوصی'} small colors={G.green} onPress={dm} disabled={blocked} style={{ flex: 1 }} />
          </View>
        ) : null}
        {!self && me?.club_id && !p.club_id && (myRole === 'leader' || myRole === 'officer') ? <Btn label={busy === 'i' ? '…' : 'دعوت به باشگاه من'} small colors={G.gold} onPress={invite} style={{ marginTop: S.s }} /> : null}
        <Panel style={{ padding: S.m, marginTop: S.m }} accent="transparent">
          <T s="آمار" style={{ fontFamily: F.bold, fontSize: TS.body, textAlign: 'right', marginBottom: S.s }} />
          <View style={{ flexDirection: rowDir(), justifyContent: 'space-between' }}>
            {([['برد', p.wins, C.green], ['تساوی', p.draws, C.gold], ['باخت', p.losses, C.red], ['گل', p.goals, C.cyan], ['درصد برد', wr, C.violet]] as const).map(([l, v, c]) => (
              <View key={l} style={{ alignItems: 'center' }}><T s={l === 'درصد برد' ? `${fa(v)}٪` : fa(v)} style={{ fontFamily: F.title, fontSize: 17, color: c }} /><T s={l} style={{ fontSize: TS.tiny, color: C.dim }} /></View>
            ))}
          </View>
          <View style={{ flexDirection: rowDir(), alignItems: 'center', marginTop: S.m }}>
            <Img src={(UI as any)[LEAGUE_IMG[p.league] || 'medal_bronze']} style={{ width: 44, height: 44 }} />
            <View style={{ flex: 1, marginRight: S.s }}>
              <T s="دیسک فعلی" style={{ fontSize: TS.cap, color: C.dim, textAlign: 'right' }} />
              <StatBars {...discStats(p.equipped_disc)} />
            </View>
          </View>
          <T s={`بهترین برد پیاپی: ${fa(p.best_streak)} · جام‌ها: ${fa(p.trophies)}`} style={{ fontSize: TS.cap, color: C.dim, textAlign: 'right', marginTop: S.s }} />
        </Panel>
        {!self ? <Btn label={busy === 'b' ? '…' : blocked ? 'رفع مسدودی' : 'مسدود کردن'} small colors={G.dark} onPress={block} style={{ marginTop: S.m }} /> : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: 26, overflow: 'hidden', alignItems: 'center', paddingVertical: S.l, borderWidth: 1, borderColor: C.line },
});
