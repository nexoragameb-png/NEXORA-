// App chrome: bottom tab bar, top HUD and bottom sheet.
import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { BackHandler, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEAM_IMG, UI2 } from '../game/assets';
import { teamById, teamKey } from '../game/util';
import { level, useStore } from '../store';
import { Img, Pill, Press, T, rowDir } from './kit';
import { C, F, N, fa } from './theme';
import { Icon } from './vec/Icon';
import { Chamfer, NxLogo } from './vec/Art';
import { useSky } from './daytime';
import { isRTL, tr } from '../i18n';
import { buzz, sfx } from '../sound';
import { useAuth } from '../net/auth';
import { levelProgress } from '../net/supabase';
import { discImg } from '../online/ui';

export type Tab = 'home' | 'team' | 'play' | 'shop' | 'profile';
type DockItem = { k: Tab | 'settings'; fa: string; en: string; icon: string };
// dock order is visual left→right in English and mirrored in Persian
const DOCK: DockItem[] = [
  { k: 'profile', fa: 'پروفایل', en: 'Profile', icon: 'user' },
  { k: 'shop', fa: 'فروشگاه', en: 'Shop', icon: 'cart' },
  { k: 'home', fa: 'آرنا', en: 'Arena', icon: 'home' },
  { k: 'team', fa: 'دیسک‌ها', en: 'Discs', icon: 'disc' },
  { k: 'settings', fa: 'تنظیمات', en: 'Settings', icon: 'gear' },
];

export const TAB_H = 74;

export const TabBar = memo(function TabBar({ tab, onTab, badge, onSettings }: { tab: Tab; onTab: (t: Tab) => void; badge?: Partial<Record<Tab, boolean>>; onSettings?: () => void }) {
  const ins = useSafeAreaInsets(); const { width: W } = useWindowDimensions(); const sky = useSky();
  const barW = Math.min(W - 16, 520);
  const items = isRTL() ? [...DOCK].reverse() : DOCK;
  const active = tab === 'play' ? 'home' : tab;
  return (
    <View pointerEvents="box-none" style={[s.tabWrap, { paddingBottom: Math.max(8, ins.bottom) }]}>
      <Chamfer style={{ width: barW, height: TAB_H - 10 }} k={16} color={sky.accent} color2={N.purple} fill={['rgba(14,10,48,.94)', 'rgba(4,2,16,.97)']}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {items.map(it => <DockBtn key={it.k} it={it} on={it.k === active} center={it.k === 'home'} badge={it.k !== 'settings' && !!badge?.[it.k as Tab]} onPress={() => (it.k === 'settings' ? onSettings?.() : onTab(it.k as Tab))} />)}
        </View>
      </Chamfer>
    </View>
  );
});

function DockBtn({ it, on, center, onPress, badge }: { it: DockItem; on: boolean; center: boolean; onPress: () => void; badge: boolean }) {
  const sc = useSharedValue(on ? 1 : 0);
  useEffect(() => { sc.value = withSpring(on ? 1 : 0, { damping: 13, stiffness: 240 }); }, [on]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -sc.value * (center ? 10 : 5) }, { scale: 1 + sc.value * .12 }] }));
  const ln = useAnimatedStyle(() => ({ opacity: sc.value, transform: [{ scaleX: .3 + sc.value * .7 }] }));
  return (
    <Pressable style={s.tabBtn} onPress={() => { if (!on) { sfx('ui'); buzz('light'); } onPress(); }}>
      <Animated.View style={[a, { alignItems: 'center' }]}>
        {center ? <View style={s.centerHex}><NxLogo size={44} /></View> : <Icon name={it.icon} size={26} opacity={on ? 1 : .7} />}
        <T s={tr(it.fa, it.en)} n={1} style={{ fontFamily: F.bold, fontSize: 10, color: on ? N.cyan : C.dim, marginTop: center ? -2 : 1 }} />
      </Animated.View>
      <Animated.View style={[s.tabLine, ln]} />
      {badge ? <View style={s.badge} /> : null}
    </Pressable>
  );
}

// ---------- top HUD: avatar · name · level · coins · gems · gift · gear ----------
export const Hud = memo(function Hud({ onProfile, onSettings, onDaily, dailyReady, onShop }: { onProfile: () => void; onSettings: () => void; onDaily: () => void; dailyReady: boolean; onShop: () => void }) {
  const ins = useSafeAreaInsets();
  const { p } = useStore(); const { profile } = useAuth();
  const lp = profile ? levelProgress(profile.xp) : null;
  const local = level(p.xp), me = teamById(p.team);
  const lv = lp ? { level: lp.level, cur: lp.cur, need: lp.need } : local;
  const name = profile?.username || p.name;
  const avatar = profile ? (profile.avatar_url ? { uri: profile.avatar_url } : discImg(profile.equipped_disc)) : TEAM_IMG[teamKey(me)];
  return (
    <View style={[s.hud, { paddingTop: ins.top + 6, flexDirection: rowDir() }]}>
      <LinearGradient pointerEvents="none" colors={['rgba(2,1,10,.92)', 'rgba(2,1,10,.5)', 'transparent']} style={StyleSheet.absoluteFill} />
      <Press onPress={onProfile} style={[s.me, { flexDirection: rowDir() }]}>
        <View>
          <View style={s.av}><Img src={avatar} fit={profile?.avatar_url ? 'cover' : 'contain'} style={{ width: 36, height: 36, borderRadius: 18 }} /></View>
          <View style={s.lvl}><T s={String(lv.level)} raw style={{ fontFamily: F.title, fontSize: 9, color: '#04122a' }} /></View>
        </View>
        <View style={{ marginHorizontal: 8, maxWidth: 104, alignItems: isRTL() ? 'flex-end' : 'flex-start' }}>
          <T s={name} n={1} raw style={{ fontFamily: F.bold, fontSize: 13 }} />
          <View style={s.xpTrack}><LinearGradient colors={[N.cyan, N.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.xpFill, { width: `${Math.max(4, lv.cur / lv.need * 100)}%` }]} /></View>
        </View>
      </Press>
      <View style={{ flex: 1 }} />
      <Pill icon={UI2.x_gem} v={profile ? profile.gems : p.gems} onPress={onShop} />
      <Pill icon={UI2.c_coin} v={p.coins} tint={C.gold} onPress={onShop} plus />
      <GiftBtn ready={dailyReady} onPress={onDaily} />
      <Press onPress={onSettings} style={s.iconBtn}><Icon name="gear" size={24} /></Press>
    </View>
  );
});

function GiftBtn({ ready, onPress }: { ready: boolean; onPress: () => void }) {
  const w = useSharedValue(0);
  useEffect(() => { if (ready) w.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true); else w.value = withTiming(0); }, [ready]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${(w.value - .5) * 16}deg` }, { scale: 1 + w.value * .08 }] }));
  return (
    <Press onPress={onPress} style={[s.iconBtn, ready && { borderColor: C.gold, backgroundColor: 'rgba(255,210,87,.14)' }]}>
      <Animated.View style={a}><Icon name="gift" size={24} /></Animated.View>
      {ready ? <View style={s.badge2} /> : null}
    </Press>
  );
}

// ---------- bottom sheet (spring in, drag the handle down to dismiss, Android back closes) ----------
export type SheetHandle = { close: () => void };
export const Sheet = forwardRef<SheetHandle, { onClosed: () => void; children: React.ReactNode; title?: string; en?: string; height?: number; accent?: string }>(function Sheet({ onClosed, children, title, en, height = .84, accent = C.cyan }, ref) {
  const { height: H } = useWindowDimensions(); const ins = useSafeAreaInsets();
  const h = Math.min(H * height, H - ins.top - 20);
  const y = useSharedValue(h), bd = useSharedValue(0);
  const closing = useRef(false);
  useEffect(() => { y.value = withSpring(0, { damping: 20, stiffness: 190, mass: .9 }); bd.value = withTiming(1, { duration: 250 }); }, []);
  const close = () => {
    if (closing.current) return; closing.current = true; buzz('light');
    bd.value = withTiming(0, { duration: 220 });
    y.value = withTiming(h, { duration: 240, easing: Easing.in(Easing.cubic) }, f => { if (f) runOnJS(onClosed)(); });
  };
  useImperativeHandle(ref, () => ({ close }));
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; }); return () => sub.remove(); }, []);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderMove: (_, g) => { y.value = Math.max(0, g.dy); },
    onPanResponderRelease: (_, g) => { if (g.dy > h * .22 || g.vy > 1) close(); else y.value = withSpring(0, { damping: 18, stiffness: 220 }); },
    onPanResponderTerminate: () => { y.value = withSpring(0); },
  })).current;
  const sa = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const ba = useAnimatedStyle(() => ({ opacity: bd.value }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(1,3,12,.72)' }, ba]}><Pressable style={StyleSheet.absoluteFill} onPress={close} /></Animated.View>
      <Animated.View style={[s.sheet, { height: h + 40, paddingBottom: 40, borderColor: accent + '55', shadowColor: accent }, sa]}>
        <LinearGradient colors={['#1c1360', '#0b0832', '#05020f']} style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 22, borderTopRightRadius: 22 }]} />
        <LinearGradient pointerEvents="none" colors={['transparent', accent, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 30, right: 30, height: 2 }} />
        <View {...pan.panHandlers} style={s.sheetHead}>
          <View style={[s.grip, { backgroundColor: accent }]} />
          {title ? (
            <View style={{ flexDirection: isRTL() ? 'row' : 'row-reverse', alignItems: 'center', width: '100%', paddingHorizontal: 16, marginTop: 8 }}>
              <Press onPress={close} style={s.x}><Icon name="close" size={18} glow={false} /></Press>
              <View style={{ flex: 1, alignItems: isRTL() ? 'flex-end' : 'flex-start' }}>
                {en ? <T s={en} style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 3, color: accent }} /> : null}
                <T s={title} n={1} style={{ fontFamily: F.title, fontSize: 20, marginTop: 1 }} />
              </View>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, paddingBottom: ins.bottom }}>{children}</View>
      </Animated.View>
    </View>
  );
});

// ---------- full-screen modal card (daily reward, chest, level up) ----------
export function Modal({ children, onClose, accent = C.gold }: { children: React.ReactNode; onClose: () => void; accent?: string }) {
  const sc = useSharedValue(.6), op = useSharedValue(0);
  useEffect(() => { sc.value = withSpring(1, { damping: 13, stiffness: 180 }); op.value = withTiming(1, { duration: 200 }); }, []);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; }); return () => sub.remove(); }, []);
  const a = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  const b = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 80, alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(1,3,12,.8)' }, b]}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /></Animated.View>
      <Animated.View style={[{ width: '90%', maxWidth: 420, borderRadius: 16, borderWidth: 1, borderColor: accent + '88', overflow: 'hidden', shadowColor: accent, shadowOpacity: .6, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 20 }, a]}>
        <LinearGradient colors={['#1c1360', '#0b0832', '#05020f']} style={StyleSheet.absoluteFill} />
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  tabWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 40 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLine: { position: 'absolute', bottom: 5, width: 22, height: 3, borderRadius: 2, backgroundColor: N.cyan, shadowColor: N.cyan, shadowOpacity: 1, shadowRadius: 6 },
  centerHex: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: 'rgba(39,230,255,.08)' },
  badge: { position: 'absolute', top: 8, right: '26%', width: 9, height: 9, borderRadius: 5, backgroundColor: C.red, borderWidth: 1.5, borderColor: '#0b1236' },
  badge2: { position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red, borderWidth: 1.5, borderColor: '#0b1236' },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 30, alignItems: 'center', paddingHorizontal: 10, paddingBottom: 14 },
  me: { alignItems: 'center', paddingVertical: 3, paddingHorizontal: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(39,230,255,.4)', backgroundColor: 'rgba(8,5,28,.82)', flexShrink: 1 },
  av: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: N.cyan, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050816' },
  lvl: { position: 'absolute', bottom: -4, alignSelf: 'center', minWidth: 20, height: 16, paddingHorizontal: 4, borderRadius: 4, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  xpTrack: { width: 70, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.12)', marginTop: 4, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3 },
  iconBtn: { width: 38, height: 38, marginLeft: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,5,28,.82)', borderWidth: 1, borderColor: 'rgba(39,230,255,.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: -40, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, overflow: 'hidden', shadowOpacity: .5, shadowRadius: 30, shadowOffset: { width: 0, height: -4 }, elevation: 24 },
  sheetHead: { alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  grip: { width: 46, height: 5, borderRadius: 3, opacity: .8 },
  x: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', backgroundColor: 'rgba(20,28,64,.9)', alignItems: 'center', justifyContent: 'center' },
});
void fa;
