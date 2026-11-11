// ARENA DUEL: five stake tiers. The entry fee is charged by the server when the match starts,
// the prize is paid to the winning side by report_match, and cancelled / abandoned matches are refunded.
import React, { memo, useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI2 } from '../game/assets';
import { Img, Panel, Press, Segment, T } from '../ui/kit';
import { C, F, fa } from '../ui/theme';
import { buzz, sfx } from '../sound';
import { useAuth } from '../net/auth';
import { ArenaTier, Mode, Room, errFa, rpc, supabase } from '../net/supabase';
import { Badge, ErrorState, Header, S, Skeleton, TS } from './ui';

const LOOK: Record<string, { g: [string, string]; icon: any }> = {
  bermuda: { g: ['#0b6b8a', '#0a2a5a'], icon: UI2.x_shield },
  nexora: { g: ['#4b2bd1', '#1a1060'], icon: UI2.x_star },
  nx: { g: ['#c2187a', '#3a0a40'], icon: UI2.x_medal },
  space: { g: ['#101a5c', '#000016'], icon: UI2.x_crown },
  kakero: { g: ['#b07a12', '#3a2004'], icon: UI2.x_gem },
};
export const TIER_FALLBACK: ArenaTier[] = [
  { id: 'bermuda', name: 'BERMUDA ARENA', name_fa: 'آرنای برمودا', currency: 'coins', entry: 100, prize: 200, goals: 3, time_s: 0, sort: 1, rule_fa: 'قوانین عادی · تا ۳ گل' },
  { id: 'nexora', name: 'NEXORA ARENA', name_fa: 'آرنای نکسورا', currency: 'coins', entry: 250, prize: 500, goals: 3, time_s: 0, sort: 2, rule_fa: 'اولین تیمی که ۳ گل بزند' },
  { id: 'nx', name: 'NX ARENA', name_fa: 'آرنای NX', currency: 'coins', entry: 500, prize: 1000, goals: 99, time_s: 300, sort: 3, rule_fa: '۵ دقیقه · جلوتر برنده است' },
  { id: 'space', name: 'SPACE ARENA', name_fa: 'آرنای فضا', currency: 'coins', entry: 2000, prize: 4000, goals: 99, time_s: 180, sort: 4, rule_fa: '۳ دقیقه' },
  { id: 'kakero', name: 'KAKERO ARENA', name_fa: 'آرنای کاکرو', currency: 'gems', entry: 50, prize: 100, goals: 5, time_s: 0, sort: 5, rule_fa: 'اولین تیمی که ۵ گل بزند' },
];
let tierCache: ArenaTier[] | null = null;
export function useTiers() {
  const [tiers, setTiers] = useState<ArenaTier[]>(tierCache || TIER_FALLBACK);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('arena_tiers').select('*').order('sort');
    if (error) { setErr(errFa(error)); return; }
    setErr(null); if (data?.length) { tierCache = data as ArenaTier[]; setTiers(tierCache); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { tiers, err, load };
}
export const tierById = (id?: string | null) => (tierCache || TIER_FALLBACK).find(t => t.id === id) || null;
export const money = (t: ArenaTier, v: number) => `${fa(v)} ${t.currency === 'gems' ? 'الماس' : 'سکه'}`;

export default function Duels({ onBack, onRoom, toast }: { onBack: () => void; onRoom: (r: Room) => void; toast: (m: string, k?: string) => void }) {
  const ins = useSafeAreaInsets(); const { profile, refreshProfile } = useAuth();
  const { tiers, err, load } = useTiers();
  const [mode, setMode] = useState<Mode>('1v1');
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const join = async (t: ArenaTier) => {
    if (busy) return;
    const bal = t.currency === 'gems' ? profile?.gems ?? 0 : profile?.coins ?? 0;
    if (bal < t.entry) { toast(`برای ${t.name_fa} ${money(t, t.entry)} لازم داری`, 'err'); buzz('heavy'); return; }
    setBusy(t.id);
    try { const r = await rpc<Room>('duel_join', { p_tier: t.id, p_mode: mode }); sfx('join'); buzz('medium'); onRoom(r); }
    catch (e) { toast(errFa(e), 'err'); } finally { setBusy(null); }
  };
  return (
    <View style={{ flex: 1 }}>
      <Header title="آرنای دوئل" en="ARENA DUEL" accent={C.gold} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 76, paddingBottom: ins.bottom + S.xl, paddingHorizontal: S.l }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([load(), refreshProfile()]); setRefreshing(false); }} tintColor={C.cyan} progressViewOffset={ins.top + 70} />}
        showsVerticalScrollIndicator={false}>
        <Panel style={{ padding: S.m }} accent={C.gold}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <T s="موجودی آنلاین" style={{ fontFamily: F.bold, fontSize: TS.small, color: C.dim }} />
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Img src={UI2.c_coin} style={{ width: 22, height: 22 }} /><T s={fa(profile?.coins ?? 0)} style={{ fontFamily: F.title, fontSize: 16, marginHorizontal: 6 }} />
              <Img src={UI2.x_gem} style={{ width: 22, height: 22, marginRight: S.m }} /><T s={fa(profile?.gems ?? 0)} style={{ fontFamily: F.title, fontSize: 16, marginRight: 6, color: '#9fd8ff' }} />
            </View>
          </View>
          <T s="ورودی هنگام شروع بازی کم می‌شود · برنده جایزه را می‌گیرد · بازی لغوشده کامل برمی‌گردد" style={{ fontSize: TS.cap, color: C.dim, textAlign: 'right', marginTop: S.s, lineHeight: 18 }} />
          <View style={{ marginTop: S.s }}><Segment value={mode} onChange={setMode} items={[['1v1', '۱ به ۱'], ['2v2', '۲ به ۲'], ['3v3', '۳ به ۳']]} accent={C.gold} /></View>
        </Panel>
        {err && !tiers.length ? <ErrorState msg={err} onRetry={load} /> : !tiers.length ? <Skeleton rows={5} h={120} /> : tiers.map((t, i) => (
          <TierCard key={t.id} t={t} i={i} busy={busy === t.id} disabled={!!busy} onPress={() => join(t)}
            afford={(t.currency === 'gems' ? profile?.gems ?? 0 : profile?.coins ?? 0) >= t.entry} />
        ))}
      </ScrollView>
    </View>
  );
}

const TierCard = memo(function TierCard({ t, i, busy, disabled, afford, onPress }: { t: ArenaTier; i: number; busy: boolean; disabled: boolean; afford: boolean; onPress: () => void }) {
  const look = LOOK[t.id] || LOOK.bermuda;
  const glow = useSharedValue(0);
  useEffect(() => { glow.value = withRepeat(withTiming(1, { duration: 2200 + i * 300, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  const gst = useAnimatedStyle(() => ({ opacity: .25 + glow.value * .45, transform: [{ translateX: -60 + glow.value * 120 }] }));
  return (
    <Animated.View entering={FadeInDown.delay(80 * i).springify().damping(16)} style={{ marginTop: S.m }}>
      <Press onPress={onPress} disabled={disabled} scaleTo={.97}>
        <View style={[st.card, { borderColor: look.g[0] }]}>
          <LinearGradient colors={look.g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Animated.View style={[st.sheen, gst]} />
          <LinearGradient colors={['rgba(255,255,255,.22)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { height: '45%' }]} />
          <Img src={look.icon} style={{ width: 64, height: 64 }} />
          <View style={{ flex: 1, marginRight: S.m, alignItems: 'flex-end' }}>
            <T s={t.name} style={{ fontFamily: F.title, fontSize: 18, color: '#fff', textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 6 }} />
            <T s={`${t.name_fa} · ${t.rule_fa}`} n={1} style={{ fontSize: TS.cap, color: '#e2ecff', marginTop: 2 }} />
            <View style={{ flexDirection: 'row-reverse', marginTop: S.s }}>
              <Badge label={`ورودی ${money(t, t.entry)}`} color={afford ? C.cyan : C.red} />
              <Badge label={`جایزه ${money(t, t.prize)}`} color={C.gold} />
            </View>
          </View>
          <View style={st.go}><T s={busy ? '…' : 'ورود'} style={{ fontFamily: F.bold, fontSize: TS.small, color: '#fff' }} /></View>
        </View>
      </Press>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  card: { minHeight: 112, borderRadius: 22, borderWidth: 1.5, overflow: 'hidden', flexDirection: 'row-reverse', alignItems: 'center', padding: S.m, shadowColor: '#000', shadowOpacity: .5, shadowRadius: 12, elevation: 8 },
  sheen: { position: 'absolute', top: -30, bottom: -30, width: 70, left: '45%', backgroundColor: 'rgba(255,255,255,.12)', transform: [{ rotate: '18deg' }] },
  go: { width: 58, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,.4)' },
});
