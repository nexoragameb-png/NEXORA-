// WORLD CUP — one per month. On the 25th (Tehran) the top 64 of the monthly ranking are seeded into
// 16 groups of 4; the top two of every group go to a single-elimination knockout. Winner: 500 gems.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI2 } from '../game/assets';
import { Btn, Img, Panel, Press, T, rowDir, startAlign } from '../ui/kit';
import { C, F, G, fa } from '../ui/theme';
import { buzz } from '../sound';
import { useAuth } from '../net/auth';
import { Entry, Room, TMatch, Tournament, errFa, rpc, supabase } from '../net/supabase';
import { useNav } from '../nav';
import { Avatar, Badge, Empty, ErrorState, Header, S, Skeleton, TS, Tabs } from './ui';
import { Bracket } from './Tournaments';

type RankRow = { user_id: string; username: string; avatar: string; avatar_url: string | null; level: number; rating: number; points: number; wins: number; draws: number; losses: number; played: number; gd: number; rank: number };
const GROUP = 'ABCDEFGHIJKLMNOP';
const left = (iso?: string | null) => {
  if (!iso) return ''; const ms = new Date(iso).getTime() - Date.now(); if (ms <= 0) return 'به‌زودی';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return d ? `${fa(d)} روز و ${fa(h)} ساعت` : h ? `${fa(h)} ساعت و ${fa(m)} دقیقه` : `${fa(m)} دقیقه`;
};

export default function WorldCup({ onBack, onRoom, toast }: { onBack: () => void; onRoom: (r: Room) => void; toast: (m: string, k?: string) => void }) {
  const ins = useSafeAreaInsets(); const { uid } = useAuth(); const nav = useNav();
  const [cup, setCup] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<TMatch[]>([]);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'q' | 'groups' | 'ko'>('q');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await rpc<Tournament>('wc_tick');
      setCup(t); setErr(null);
      if (t?.id && t.status !== 'registration') {
        const [e, m] = await Promise.all([
          supabase.from('tournament_entries').select('*').eq('tournament_id', t.id).order('seed'),
          supabase.from('tournament_matches').select('*').eq('tournament_id', t.id).order('round').order('idx'),
        ]);
        setEntries((e.data || []) as Entry[]); setMatches((m.data || []) as TMatch[]);
        setTab(x => (x === 'q' ? (t.stage === 'groups' ? 'groups' : 'ko') : x));
      }
      const r = await rpc<RankRow[]>('monthly_ranking', { p_month: t?.month ?? null, p_limit: 100 });
      setRanking(r || []);
    } catch (e) { setErr(errFa(e)); }
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('wc').on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const names = useMemo(() => Object.fromEntries(entries.map(e => [e.id, e.team_name])), [entries]);
  const mine = entries.find(e => uid && e.members.includes(uid));
  const next = mine ? matches.find(m => (m.entry_a === mine.id || m.entry_b === mine.id) && (m.status === 'ready' || m.status === 'live')) : undefined;
  const myRank = ranking?.find(r => r.user_id === uid);
  const openRoom = async (m: TMatch) => {
    if (busy) return; setBusy(true);
    try { const r = await rpc<Room>('open_tournament_room', { p_tm: m.id }); buzz('medium'); onRoom(r); } catch (e) { toast(errFa(e), 'err'); } finally { setBusy(false); }
  };

  const spin = useSharedValue(0);
  useEffect(() => { spin.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false); }, []);
  const halo = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const stageFa = !cup ? '' : cup.status === 'registration' ? 'مرحله‌ی انتخابی' : cup.status === 'finished' ? 'پایان‌یافته' : cup.stage === 'groups' ? 'مرحله‌ی گروهی' : 'مرحله‌ی حذفی';
  return (
    <View style={{ flex: 1 }}>
      <Header title="جام جهانی" en="NEXORA WORLD CUP" accent={C.gold} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 76, paddingBottom: ins.bottom + S.xl }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.gold} progressViewOffset={ins.top + 70} />}>
        <View style={{ paddingHorizontal: S.l }}>
          <View style={st.hero}>
            <LinearGradient colors={['#6b4a0a', '#1a1030', '#05040e']} style={StyleSheet.absoluteFill} />
            <Animated.View style={[st.halo, halo]}><LinearGradient colors={['rgba(255,210,87,.0)', 'rgba(255,210,87,.35)', 'rgba(255,210,87,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /></Animated.View>
            <Img src={UI2.x_trophy} style={{ width: 96, height: 96 }} />
            <T s={cup?.name || 'جام جهانی NEXORA'} n={1} style={{ fontFamily: F.title, fontSize: 18, color: '#fff', marginTop: 4 }} />
            <T s="۶۴ بازیکن · ۱۶ گروه ۴ نفره · حذفی تا فینال" style={{ fontSize: TS.cap, color: '#f3e3b0', marginTop: 2 }} />
            <View style={{ flexDirection: rowDir(), marginTop: S.s }}>
              <Badge label={stageFa} color={C.gold} live={cup?.status === 'running'} />
              <Badge label="جایزه‌ی قهرمان: ۵۰۰ الماس" color="#9fd8ff" />
            </View>
            {cup?.status === 'registration' ? <T s={`قرعه‌کشی: ${left(cup.starts_at)} دیگر`} style={{ fontFamily: F.bold, fontSize: TS.small, color: C.gold, marginTop: S.s }} /> : null}
          </View>

          {err ? <ErrorState msg={err} onRetry={load} /> : null}
          {cup?.status === 'registration' ? (
            <Panel style={{ padding: S.m, marginTop: S.m }} accent={myRank && myRank.rank <= 64 ? C.green : C.line}>
              <T s={myRank ? (myRank.rank <= 64 ? `رتبه‌ی ماهانه‌ی تو: ${fa(myRank.rank)} — فعلاً جزو ۶۴ نفر هستی!` : `رتبه‌ی ماهانه‌ی تو: ${fa(myRank.rank)} — برای صعود باید به ۶۴ نفر اول برسی`)
                : 'هنوز این ماه بازی آنلاین نکرده‌ای. هر برد ۳ امتیاز و هر تساوی ۱ امتیاز دارد.'} style={{ fontSize: TS.small, textAlign: 'right', lineHeight: 22 }} />
            </Panel>
          ) : null}
          {next ? (
            <Panel style={{ padding: S.m, marginTop: S.m }} accent={C.red} glow>
              <T s={next.bracket === 'group' ? `بازی گروهی تو · دور ${fa(next.round)}` : 'بازی حذفی تو'} style={{ fontFamily: F.bold, fontSize: TS.small, color: C.red, textAlign: 'right' }} />
              <T s={`${names[next.entry_a || ''] || '؟'}  vs  ${names[next.entry_b || ''] || '؟'}`} n={1} style={{ fontFamily: F.title, fontSize: TS.h, textAlign: 'center', marginVertical: S.s }} />
              {next.deadline ? <T s={`مهلت: ${left(next.deadline)} — بعد از آن نتیجه خودکار ثبت می‌شود`} style={{ fontSize: TS.tiny, color: C.dim, textAlign: 'center', marginBottom: S.s }} /> : null}
              <Btn label={busy ? '…' : 'ورود به اتاق مسابقه'} colors={G.red} onPress={() => openRoom(next)} />
            </Panel>
          ) : null}
          <View style={{ marginTop: S.l }}>
            <Tabs items={[['q', 'رده‌بندی ماه'], ['groups', 'گروه‌ها'], ['ko', 'حذفی']]} value={tab} onChange={setTab} />
          </View>
        </View>

        <Animated.View key={tab} entering={FadeIn.duration(200)} style={{ marginTop: S.m }}>
          {tab === 'q' ? (
            !ranking ? <Skeleton rows={6} h={52} /> : !ranking.length ? <Empty img={UI2.x_medal} title="هنوز بازی‌ای ثبت نشده" sub="اولین برد این ماه را بگیر!" /> :
              ranking.map((r, i) => (
                <View key={r.user_id} style={{ paddingHorizontal: S.l }}>
                  {i === 64 ? <View style={st.cut}><T s="خط صعود — ۶۴ نفر اول" style={{ fontSize: TS.tiny, color: C.red }} /></View> : null}
                  <Press onPress={() => nav.openProfile(r.user_id)} scaleTo={.98}><View style={[st.row, r.user_id === uid && { borderColor: C.gold }]}>
                    <T s={fa(r.rank)} style={{ width: 32, fontFamily: F.title, color: r.rank <= 3 ? C.gold : r.rank <= 64 ? C.green : C.dim, textAlign: 'center' }} />
                    <Avatar avatar={r.avatar} url={r.avatar_url} size={36} />
                    <T s={r.username} n={1} style={{ flex: 1, fontFamily: F.bold, fontSize: TS.small, textAlign: 'right', marginRight: S.s }} />
                    <T s={`${fa(r.wins)}-${fa(r.draws)}-${fa(r.losses)}`} style={{ fontSize: TS.cap, color: C.dim, width: 64, textAlign: 'center' }} />
                    <T s={fa(r.points)} style={{ fontFamily: F.title, fontSize: TS.h, color: C.gold, width: 40, textAlign: 'center' }} />
                  </View></Press>
                </View>
              ))
          ) : tab === 'groups' ? (
            !entries.length ? <Empty img={UI2.c_calendar} title="گروه‌ها بعد از قرعه‌کشی ساخته می‌شوند" /> :
              <View style={{ paddingHorizontal: S.l }}>
                {Array.from({ length: Math.max(...entries.map(e => (e.group_no ?? 0))) + 1 }, (_, g) => {
                  const rows = entries.filter(e => e.group_no === g).sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || (a.seed ?? 0) - (b.seed ?? 0));
                  return (
                    <Panel key={g} style={{ padding: S.s, marginBottom: S.s }} accent={rows.some(r => r.id === mine?.id) ? C.gold : 'transparent'}>
                      <T s={`گروه ${GROUP[g]}`} style={{ fontFamily: F.bold, fontSize: TS.small, color: C.gold, textAlign: 'right', marginBottom: 4 }} />
                      {rows.map((e, i) => (
                        <View key={e.id} style={{ flexDirection: rowDir(), alignItems: 'center', height: 30 }}>
                          <View style={[st.dot, { backgroundColor: i < 2 ? C.green : C.dim2 }]} />
                          <T s={e.team_name} n={1} style={{ flex: 1, fontSize: TS.small, textAlign: 'right', marginRight: 6, color: e.id === mine?.id ? C.gold : C.text }} />
                          <T s={`${fa(e.played)} بازی`} style={{ width: 52, fontSize: TS.tiny, color: C.dim, textAlign: 'center' }} />
                          <T s={`${e.gf - e.ga >= 0 ? '+' : ''}${fa(e.gf - e.ga)}`} style={{ width: 36, fontSize: TS.cap, color: C.dim, textAlign: 'center' }} />
                          <T s={fa(e.points)} style={{ width: 30, fontFamily: F.bold, fontSize: TS.small, textAlign: 'center' }} />
                        </View>
                      ))}
                    </Panel>
                  );
                })}
              </View>
          ) : (
            matches.some(m => m.bracket === 'main')
              ? <Bracket matches={matches} names={names} format="single_elim" myEntry={mine?.id} canOverride={false} onOverride={() => {}} />
              : <Empty img={UI2.x_trophy} title="مرحله‌ی حذفی بعد از پایان گروه‌ها" sub="دو نفر اول هر گروه صعود می‌کنند" />
          )}
        </Animated.View>
        <T s="بازی‌ها در اتاق‌های خصوصی تورنمنت انجام می‌شوند؛ بازی‌ای که تا مهلتش انجام نشود: گروهی مساوی ۰-۰، حذفی به نفع سید بالاتر." style={{ fontSize: TS.tiny, color: C.dim2, textAlign: 'center', marginTop: S.l, paddingHorizontal: S.xl, lineHeight: 18 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: 26, overflow: 'hidden', alignItems: 'center', paddingVertical: S.l, borderWidth: 1.5, borderColor: 'rgba(255,210,87,.6)' },
  halo: { position: 'absolute', width: 420, height: 420, top: -120 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', height: 52, paddingHorizontal: S.s, marginBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(10,16,44,.86)' },
  cut: { alignItems: 'center', borderTopWidth: 1, borderColor: C.red, borderStyle: 'dashed', paddingVertical: 4, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
