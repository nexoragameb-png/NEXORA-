import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SG, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSky } from './daytime';

// v3 backdrop: fully procedural (no photos / star tiles). Sky colours follow the local time of day,
// a stadium silhouette with floodlights sits on the horizon, a soft neon haze drifts on the UI thread.
export type SpaceTheme = 'base' | 'win' | 'lose' | 'system' | 'hub' | 'stadium' | 'stadium2' | 'portal';
const MOOD: Partial<Record<SpaceTheme, string>> = { win: 'rgba(255,200,60,.22)', lose: 'rgba(255,50,80,.2)', system: 'rgba(39,230,255,.16)', portal: 'rgba(164,59,255,.2)' };

function Space({ theme = 'base', dim = 0, stars = true }: { theme?: SpaceTheme; dim?: number; stars?: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const sky = useSky();
  const b = useSharedValue(0);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  const haze = useAnimatedStyle(() => ({ transform: [{ translateX: -20 + b.value * 40 }, { scale: 1 + b.value * .06 }] }));
  const pts = useMemo(() => Array.from({ length: 70 }, (_, i) => { const r = Math.sin(i * 91.7) * 43758.5453; const f = r - Math.floor(r); const g = Math.sin(i * 12.3) * 9631.1; const q = g - Math.floor(g); return { x: f * W, y: q * H * .62, r: .5 + ((f * 7) % 1) * 1.3, o: .3 + ((q * 5) % 1) * .7 }; }), [W, H]);
  const hy = H * .74; // horizon
  const night = sky.stars;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#02010a', overflow: 'hidden' }]}>
      <LinearGradient colors={[sky.top, sky.mid, sky.low]} locations={[0, .55, 1]} style={[StyleSheet.absoluteFill, { bottom: H - hy }]} />
      <LinearGradient colors={['#0a0626', '#05020f']} style={[StyleSheet.absoluteFill, { top: hy }]} />
      <Animated.View style={[StyleSheet.absoluteFill, haze]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="hz1" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#a43bff" stopOpacity={.35} /><Stop offset="1" stopColor="#a43bff" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="hz2" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#27e6ff" stopOpacity={.22} /><Stop offset="1" stopColor="#27e6ff" stopOpacity={0} /></RadialGradient>
          </Defs>
          <Ellipse cx={W * .2} cy={H * .25} rx={W * .7} ry={H * .22} fill="url(#hz1)" />
          <Ellipse cx={W * .85} cy={H * .45} rx={W * .6} ry={H * .2} fill="url(#hz2)" />
        </Svg>
      </Animated.View>
      {stars && night > .05 ? (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <G opacity={night}>{pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#e8fbff" opacity={p.o} />)}</G>
        </Svg>
      ) : null}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <SG id="st" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#140c3a" /><Stop offset="1" stopColor="#05020f" /></SG>
          <RadialGradient id="fl" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fffbe8" stopOpacity={.95} /><Stop offset=".3" stopColor="#bfe9ff" stopOpacity={.4} /><Stop offset="1" stopColor="#bfe9ff" stopOpacity={0} /></RadialGradient>
        </Defs>
        {/* stadium bowl silhouette */}
        <Path d={`M0 ${hy - 40}C${W * .25} ${hy - 70} ${W * .75} ${hy - 70} ${W} ${hy - 40}V${hy + 30}H0Z`} fill="url(#st)" />
        <Path d={`M0 ${hy - 40}C${W * .25} ${hy - 70} ${W * .75} ${hy - 70} ${W} ${hy - 40}`} stroke="#27e6ff" strokeOpacity={.55} strokeWidth={1.5} fill="none" />
        <Path d={`M0 ${hy - 22}C${W * .25} ${hy - 48} ${W * .75} ${hy - 48} ${W} ${hy - 22}`} stroke="#a43bff" strokeOpacity={.35} strokeWidth={1} fill="none" />
        {[.12, .88].map((fx, i) => (
          <G key={i}>
            <Path d={`M${W * fx} ${hy - 56}V${hy - 130}`} stroke="#3a3470" strokeWidth={3} />
            <Path d={`M${W * fx - 16} ${hy - 140}H${W * fx + 16}V${hy - 128}H${W * fx - 16}Z`} fill="#2a2460" stroke="#7fe8ff" strokeOpacity={.3 + sky.lights * .7} />
            {sky.lights > .2 ? <Ellipse cx={W * fx} cy={hy - 134} rx={46 * sky.lights + 10} ry={30 * sky.lights + 8} fill="url(#fl)" opacity={sky.lights} /> : null}
          </G>
        ))}
        <Ellipse cx={W / 2} cy={hy + 40} rx={W * .62} ry={50} fill="#16653c" opacity={.25} />
      </Svg>
      {MOOD[theme] ? <View style={[StyleSheet.absoluteFill, { backgroundColor: MOOD[theme] }]} /> : null}
      <LinearGradient colors={[`rgba(2,1,10,${.45 + dim})`, `rgba(2,1,10,${.1 + dim})`, `rgba(2,1,10,${.6 + dim})`]} locations={[0, .45, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}
export default memo(Space);
