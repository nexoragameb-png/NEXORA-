// v3 Home: a first-person stadium hub. Drag to look around, tap a gate (or ENTER) to open it.
// One Skia <Canvas> renders the whole procedural world on the UI thread (see hub/scene.ts);
// React only renders the light overlay (labels, focus card, reward shortcuts) and re-renders
// when the focused gate changes — never per frame.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, withSpring } from 'react-native-reanimated';
import { Canvas, Picture, Skia, SkPath } from '@shopify/react-native-skia';
import { useStore, league, LEAGUE_FA } from '../store';
import { Btn, Press, T, rowDir } from '../ui/kit';
import { C, F, G, N, fa } from '../ui/theme';
import { Icon } from '../ui/vec/Icon';
import { Chamfer, LeagueEmblem, Robot } from '../ui/vec/Art';
import { GLYPHS } from '../ui/vec/glyphs';
import { useSky } from '../ui/daytime';
import { MODES, Mode } from './Setup';
import type { OnlineEntry } from '../nav';
import { DEG, GateDef, SceneCfg, drawScene, gateRect } from './hub/scene';
import { tr, isRTL } from '../i18n';
import { buzz, sfx } from '../sound';

type Props = { top: number; bottom: number; onOnline: (e?: OnlineEntry) => void; onMode: (m: Mode) => void; onTab: (t: 'team' | 'shop' | 'play' | 'profile') => void; onDaily: () => void; onSettings: () => void; onChest: () => void; dailyReady: boolean; chestReady: boolean };
type Gate = GateDef & { icon: string; fa: string; en: string; say: [string, string]; act: () => void };
const LIMIT = 112 * DEG;

function Home({ top, bottom, onOnline, onMode, onTab, onDaily, onChest, dailyReady, chestReady }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const { p } = useStore(); const lg = league(p.trophies); const sky = useSky();
  const hq = p.quality === 'high';

  const gates: Gate[] = useMemo(() => [
    { key: 'quick', ang: 0, color: N.cyan, main: true, icon: 'play', fa: 'بازی سریع', en: 'QUICK MATCH', say: ['یه مسابقه‌ی فوری با ربات؛ سکه و جام بگیر!', 'Instant match vs the bot — earn coins & trophies!'], act: () => onMode(MODES[0]) },
    { key: 'online', ang: 28 * DEG, color: '#ff4fd8', icon: 'globe', fa: 'آنلاین', en: 'ONLINE', say: ['بازیکن‌های واقعی، دوئل، تورنمنت و جام جهانی.', 'Real players: duels, tournaments, World Cup.'], act: () => onOnline('hub') },
    { key: 'cup', ang: -28 * DEG, color: C.gold, icon: 'trophy', fa: 'جام نکسورا', en: 'NEXORA CUP', say: ['سه حریف تا فینال؛ قهرمان ۲۰ الماس می‌گیره.', 'Three rounds to the final — champions win 20 gems.'], act: () => onMode(MODES[1]) },
    { key: 'galaxy', ang: 56 * DEG, color: '#a43bff', icon: 'planet', fa: 'چالش کهکشانی', en: 'GALAXY CHALLENGE', say: ['دو دقیقه مقابل ربات افسانه‌ای، جایزه‌ی سه برابر.', 'Two minutes vs the legendary bot — triple rewards.'], act: () => onMode(MODES[2]) },
    { key: 'local', ang: -56 * DEG, color: C.green, icon: 'duo', fa: 'دو نفره', en: 'LOCAL 2P', say: ['با دوستت روی همین گوشی بازی کن.', 'Play a friend on this phone.'], act: () => onMode(MODES[3]) },
    { key: 'train', ang: 84 * DEG, color: '#7fc8ff', icon: 'target', fa: 'تمرین', en: 'TRAINING', say: ['بدون تایمر، برای گرم کردن دست.', 'No timer — warm up your flicks.'], act: () => onMode(MODES[4]) },
    { key: 'team', ang: -84 * DEG, color: '#27e6ff', icon: 'disc', fa: 'دیسک‌ها', en: 'DISCS', say: ['دیسک، توپ، زمین و ترکیبت رو انتخاب کن.', 'Pick your disc, ball, pitch and formation.'], act: () => onTab('team') },
    { key: 'shop', ang: 112 * DEG, color: '#ff7ae0', icon: 'cart', fa: 'فروشگاه', en: 'SHOP', say: ['صندوقچه‌ها، دیسک‌های دلوکس و بسته‌ها.', 'Chests, Deluxe discs and packs.'], act: () => onTab('shop') },
    { key: 'profile', ang: -112 * DEG, color: '#9fb3ff', icon: 'user', fa: 'پروفایل', en: 'PROFILE', say: ['آمار، لیگ و مأموریت‌هات اینجاست.', 'Your stats, league and missions.'], act: () => onTab('profile') },
  ], [onMode, onOnline, onTab]);

  const cfg: SceneCfg = useMemo(() => ({ W, H, f: Math.min(W * .82, H * .55), cy: H * .5, camY: 1.7, R: 6.6, gw: 2.2, gh: 3.3, hq }), [W, H, hq]);
  const icons = useMemo(() => gates.map(g => {
    const gl = GLYPHS[g.icon]; const out: SkPath[] = [];
    const b = gl.body?.length ? Skia.Path.MakeFromSVGString(gl.body.join(' ')) : (gl.lines ? Skia.Path.MakeFromSVGString(gl.lines.join(' ')) : null);
    if (b) out.push(b); const l = gl.body?.length && gl.lines ? Skia.Path.MakeFromSVGString(gl.lines.join(' ')) : null; if (l) out.push(l);
    return out;
  }), [gates]);
  const defs: GateDef[] = useMemo(() => gates.map(g => ({ key: g.key, ang: g.ang, color: g.color, main: g.main })), [gates]);
  const angs = useMemo(() => gates.map(g => g.ang), [gates]);

  const yaw = useSharedValue(0), t = useSharedValue(0), focusSV = useSharedValue(0);
  const [focus, setFocus] = useState(0);
  useFrameCallback(f => { t.value = (f.timeSinceFirstFrame || 0) / 1000; });
  useAnimatedReaction(() => {
    let best = 0, bd = 1e9; for (let i = 0; i < angs.length; i++) { const d = Math.abs(angs[i] - yaw.value); if (d < bd) { bd = d; best = i; } }
    return best;
  }, (v, prev) => { focusSV.value = v; if (v !== prev) runOnJS(setFocus)(v); }, [angs]);
  const pic = useDerivedValue(() => drawScene(cfg, yaw.value, t.value, sky, defs, icons, focusSV.value), [cfg, sky, defs, icons]);

  const snapTo = useCallback((i: number) => { yaw.value = withSpring(angs[i], { damping: 18, stiffness: 120, mass: .9 }); }, [angs]);
  const open = useCallback((i: number) => { sfx('ui'); buzz('medium'); snapTo(i); setTimeout(() => gates[i].act(), 160); }, [gates, snapTo]);
  const st = useRef({ y0: 0, t0: 0 });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderGrant: () => { cancelAnimation(yaw); st.current = { y0: yaw.value, t0: Date.now() }; },
    onPanResponderMove: (_, g) => {
      let y = st.current.y0 - g.dx / cfg.f * 1.15;
      if (y > LIMIT) y = LIMIT + (y - LIMIT) * .3; else if (y < -LIMIT) y = -LIMIT + (y + LIMIT) * .3;
      yaw.value = y;
    },
    onPanResponderRelease: (e, g) => {
      if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8 && Date.now() - st.current.t0 < 400) {
        const { locationX: x, locationY: y } = e.nativeEvent; let hit = -1, hz = 1e9;
        for (let i = 0; i < angs.length; i++) { const r = gateRect(angs[i], yaw.value, cfg); if (r && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3] && r[4] < hz) { hz = r[4]; hit = i; } }
        if (hit >= 0) open(hit); return;
      }
      const target = Math.max(-LIMIT, Math.min(LIMIT, yaw.value - g.vx * .32));
      let best = 0, bd = 1e9; angs.forEach((a, i) => { const d = Math.abs(a - target); if (d < bd) { bd = d; best = i; } });
      buzz('light'); snapTo(best);
    },
  }), [cfg, angs, open, snapTo]);

  const g = gates[focus];
  const cardBottom = bottom + 8;
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none"><Picture picture={pic} /></Canvas>
        {gates.map((gt, i) => (gt.main ? null : <GateLabel key={gt.key} gate={gt} yaw={yaw} cfg={cfg} focused={i === focus} />))}
        <ArenaScreen yaw={yaw} cfg={cfg} />
      </View>

      {/* top strip: league + reward shortcuts */}
      <Animated.View entering={FadeIn.duration(400)} style={[s.strip, { top, flexDirection: rowDir() }]} pointerEvents="box-none">
        <Press onPress={() => onTab('profile')} style={[s.league, { flexDirection: rowDir() }]}>
          <LeagueEmblem tier={lg.idx} size={30} />
          <View style={{ marginHorizontal: 6 }}>
            <T s={tr(`لیگ ${LEAGUE_FA[lg.name]}`, `${lg.name} LEAGUE`)} n={1} style={{ fontFamily: F.bold, fontSize: 11 }} />
            <View style={s.lgBar}><View style={[s.lgFill, { width: `${Math.max(4, Math.min(100, (p.trophies - lg.from) / (lg.to - lg.from) * 100))}%` }]} /></View>
          </View>
          <T s={fa(p.trophies)} style={{ fontFamily: F.head, fontSize: 11, color: C.gold }} />
        </Press>
        <View style={{ flex: 1 }} />
        <Shortcut icon="calendar" label={tr('روزانه', 'Daily')} dot={dailyReady} onPress={onDaily} />
        <Shortcut icon="chest" label={tr('صندوقچه', 'Chest')} dot={chestReady} onPress={onChest} />
        <Shortcut icon="gamepad" label={tr('حالت‌ها', 'Modes')} onPress={() => onTab('play')} />
      </Animated.View>

      {/* focused gate card */}
      <View pointerEvents="box-none" style={[s.bottomWrap, { bottom: cardBottom }]}>
        <Animated.View key={g.key} entering={FadeInDown.duration(260)} style={[s.say, { flexDirection: rowDir() }]}>
          <Robot size={46} mood={focus % 2} />
          <View style={[s.bubble, { borderColor: g.color + '88' }]}><T s={tr(g.say[0], g.say[1])} n={2} style={{ fontSize: 12, color: '#e8fbff', textAlign: isRTL() ? 'right' : 'left' }} /></View>
        </Animated.View>
        {g.key === 'online' ? <OnlineChips onOnline={onOnline} /> : null}
        <Chamfer style={[s.card]} color={g.color} color2={N.purple} k={14}>
          <View style={{ flexDirection: rowDir(), alignItems: 'center', padding: 12 }}>
            <Icon name={g.icon} size={44} plate={g.color} />
            <View style={{ flex: 1, marginHorizontal: 10, alignItems: isRTL() ? 'flex-end' : 'flex-start' }}>
              <T s={tr(g.fa, g.en)} n={1} style={{ fontFamily: F.title, fontSize: 18 }} />
              <T s={isRTL() ? g.en : g.fa} n={1} raw style={{ fontFamily: isRTL() ? F.head : F.fa, fontSize: 9, letterSpacing: isRTL() ? 2 : 0, color: g.color }} />
            </View>
            <Btn label={tr('ورود', 'ENTER')} small onPress={() => open(focus)} colors={g.key === 'cup' ? G.gold : g.key === 'online' ? ['#ff4fd8', '#a43bff', '#5b3bff'] : G.primary} style={{ minWidth: 104 }} />
          </View>
        </Chamfer>
        <View style={[s.dots, { flexDirection: 'row' }]}>
          {[...gates.keys()].sort((a, b) => gates[a].ang - gates[b].ang).map(i => <Press key={i} onPress={() => snapTo(i)} sound={false} haptic={false}><View style={[s.dot, i === focus && { backgroundColor: gates[i].color, width: 18 }]} /></Press>)}
        </View>
      </View>
    </View>
  );
}
export default memo(Home);

// label floating above each gate, positioned on the UI thread
const GateLabel = memo(function GateLabel({ gate, yaw, cfg, focused }: { gate: Gate; yaw: any; cfg: SceneCfg; focused: boolean }) {
  const LW = 150, ang = gate.ang, main = !!gate.main;
  const a = useAnimatedStyle(() => {
    const r = gateRect(ang, yaw.value, cfg);
    if (!r || r[2] < -40 || r[0] > cfg.W + 40) return { opacity: 0, transform: [{ translateX: -999 }, { translateY: -999 }] };
    const k = Math.max(.7, Math.min(1.15, 6.6 / r[4]));
    const d = Math.abs(ang - yaw.value);
    return { opacity: Math.max(0, 1 - d / (60 * DEG)), transform: [{ translateX: (r[0] + r[2]) / 2 - LW / 2 }, { translateY: r[1] - 44 * k - (main ? 10 : 0) }, { scale: k }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: LW, alignItems: 'center' }, a]}>
      <View style={[s.gl, { borderColor: gate.color + (focused ? 'ff' : '77'), backgroundColor: focused ? 'rgba(10,6,38,.9)' : 'rgba(6,4,22,.7)' }]}>
        <T s={tr(gate.fa, gate.en)} n={1} style={{ fontFamily: F.bold, fontSize: 13, color: '#fff' }} />
        <T s={gate.en} n={1} raw style={{ fontFamily: F.head, fontSize: 7, letterSpacing: 2, color: gate.color }} />
      </View>
    </Animated.View>
  );
});

// the big stadium screen above the main gate
const ArenaScreen = memo(function ArenaScreen({ yaw, cfg }: { yaw: any; cfg: SceneCfg }) {
  const SW = 230;
  const a = useAnimatedStyle(() => {
    const d = -yaw.value; if (Math.abs(d) > 50 * DEG) return { opacity: 0, transform: [{ translateX: -999 }] };
    const x = cfg.W / 2 + Math.tan(d) * cfg.f;
    const r = gateRect(0, yaw.value, cfg);
    return { opacity: 1 - Math.abs(d) / (50 * DEG), transform: [{ translateX: x - SW / 2 }, { translateY: (r ? r[1] : cfg.cy - cfg.f * .4) - 78 }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: SW }, a]}>
      <Chamfer k={10} color={N.cyan} color2={N.purple} fill={['rgba(16,10,60,.88)', 'rgba(4,2,16,.94)']} brackets={false}>
        <View style={{ paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
          <T s={tr('بازی سریع · ورود به آرنا', 'QUICK MATCH · ENTER ARENA')} n={1} style={{ fontFamily: F.bold, fontSize: 13, color: '#e8fbff' }} />
          <T s={tr('مسابقه بعدی · جام نکسورا', 'NEXT MATCH · NEXORA CUP')} n={1} style={{ fontSize: 10, color: '#9fefff', marginTop: 1 }} />
          <T s="NEXORA ARENA" raw style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 4, color: N.cyan, marginTop: 2 }} />
        </View>
      </Chamfer>
    </Animated.View>
  );
});

function Shortcut({ icon, label, dot, onPress }: { icon: string; label: string; dot?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={s.sc}>
      <Icon name={icon} size={28} />
      <T s={label} n={1} style={{ fontSize: 9, color: '#cfe8ff', marginTop: 1 }} />
      {dot ? <View style={s.badge} /> : null}
    </Press>
  );
}

function OnlineChips({ onOnline }: { onOnline: (e?: OnlineEntry) => void }) {
  const items: [Exclude<OnlineEntry, object>, string, string, string][] = [['duels', 'دوئل', 'Duels', 'crown'], ['worldcup', 'جام جهانی', 'World Cup', 'trophy'], ['tours', 'تورنمنت', 'Tours', 'medal'], ['leagues', 'لیگ', 'Leagues', 'shield'], ['challenges', 'چالش', 'Challenges', 'calendar'], ['social', 'اجتماعی', 'Social', 'team']];
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ flexDirection: rowDir(), flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 }}>
      {items.map(([k, f, e, ic]) => (
        <Press key={k} onPress={() => onOnline(k)} style={[s.chip, { flexDirection: rowDir() }]}>
          <Icon name={ic} size={16} /><T s={tr(f, e)} n={1} style={{ fontFamily: F.bold, fontSize: 10, marginHorizontal: 4 }} />
        </Press>
      ))}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  strip: { position: 'absolute', left: 10, right: 10, alignItems: 'center' },
  league: { alignItems: 'center', paddingHorizontal: 8, height: 44, borderRadius: 8, backgroundColor: 'rgba(6,4,22,.78)', borderWidth: 1, borderColor: 'rgba(255,210,87,.4)', maxWidth: 190 },
  lgBar: { width: 70, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.12)', marginTop: 3, overflow: 'hidden' },
  lgFill: { height: '100%', backgroundColor: C.gold },
  sc: { width: 50, height: 50, marginLeft: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,4,22,.78)', borderWidth: 1, borderColor: 'rgba(39,230,255,.35)' },
  badge: { position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: C.red, borderWidth: 1.5, borderColor: '#0b1236' },
  bottomWrap: { position: 'absolute', left: 12, right: 12 },
  say: { alignItems: 'flex-end', marginBottom: 6 },
  bubble: { flex: 1, marginHorizontal: 6, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(8,6,30,.88)' },
  card: { minHeight: 70 },
  dots: { justifyContent: 'center', marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 3, backgroundColor: 'rgba(255,255,255,.3)' },
  gl: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  chip: { alignItems: 'center', height: 30, paddingHorizontal: 8, margin: 2, borderRadius: 6, backgroundColor: 'rgba(8,6,30,.88)', borderWidth: 1, borderColor: 'rgba(255,79,216,.45)' },
});
