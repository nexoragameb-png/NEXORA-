import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import Animated, { Easing, FadeInDown, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGrad, Path, Stop } from 'react-native-svg';
import { hexPath } from './vec/glyphs';
import { Image } from 'expo-image';
import { C, F, G, N } from './theme';
import { sfx, buzz } from '../sound';
import { isRTL, xl } from '../i18n';
import { VecArt, isVec } from './vec/Art';

// direction helpers: Persian lays rows out right-to-left, English left-to-right
export const rowDir = () => (isRTL() ? 'row-reverse' : 'row') as 'row' | 'row-reverse';
export const startAlign = () => (isRTL() ? 'flex-end' : 'flex-start') as 'flex-end' | 'flex-start';
export const textStart = () => (isRTL() ? 'right' : 'left') as 'right' | 'left';

const FA = /[\u0600-\u06FF]/;
const HEAVY = new Set([F.title, F.head, F.bold]);

// Text: Persian strings switch to Vazirmatn automatically (Orbitron/Exo have no Persian glyphs)
// and drop letter-spacing, which would break Persian letter joining.
// In English mode Persian literals are translated (xl) and right-aligned text flips to the left.
export const T = memo(function T({ s, style, n, raw }: { s: string | number; style?: any; n?: number; raw?: boolean }) {
  const base: any = StyleSheet.flatten([{ color: C.text, fontFamily: F.body, fontSize: 14 }, style]);
  if (typeof s === 'string' && !raw) s = xl(s);
  if (!isRTL() && base.textAlign === 'right') base.textAlign = 'left';
  if (typeof s === 'string' && FA.test(s)) {
    const heavy = HEAVY.has(base.fontFamily);
    base.fontFamily = heavy ? F.faB : F.fa; base.letterSpacing = 0; base.writingDirection = 'rtl';
    if (heavy && base.fontSize) base.fontSize = Math.round(base.fontSize * (base.fontSize < 12 ? 1.2 : 1.03));
  }
  return <Text numberOfLines={n} allowFontScaling={false} style={base}>{s}</Text>;
});

// fast cached image (expo-image: disk + memory cache, decoded off the JS thread)
// vector tokens (src/ui/vec) render as SVG; real bitmaps (discs, balls, fields, avatars) stay on expo-image
export const Img = memo(function Img({ src, style, fit = 'contain', tint }: { src: any; style?: any; fit?: 'contain' | 'cover'; tint?: string }) {
  if (isVec(src)) return <VecArt t={src} style={style} />;
  return <Image source={src} style={style} contentFit={fit} transition={0} cachePolicy="memory-disk" tintColor={tint} />;
});

const OUTER = new Set(['flex', 'width', 'height', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'zIndex', 'flexGrow', 'flexShrink', 'flexBasis']);
// Press: spring scale on the UI thread, sound + haptic on tap
export function Press({ onPress, children, style, disabled, sound = true, scaleTo = .94, haptic = true, onLongPress }: { onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; sound?: boolean; scaleTo?: number; haptic?: boolean; onLongPress?: () => void }) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  // layout keys go on the Pressable so flex / width / margins behave like a plain View
  const flat: any = StyleSheet.flatten(style) || {}; const outer: any = {}, inner: any = {};
  for (const k in flat) (OUTER.has(k) ? outer : inner)[k] = flat[k];
  if (outer.flex !== undefined || outer.width !== undefined || outer.height !== undefined || outer.alignSelf === 'stretch') { inner.flexGrow = 1; inner.alignSelf = 'stretch'; }
  return (
    <Pressable style={outer} disabled={disabled} onLongPress={onLongPress}
      onPressIn={() => { sc.value = withSpring(scaleTo, { damping: 18, stiffness: 420 }); }}
      onPressOut={() => { sc.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      onPress={() => { if (sound) sfx('ui'); if (haptic) buzz('light'); onPress && onPress(); }}>
      <Animated.View style={[style, a, disabled && { opacity: .45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

// glass panel: deep purple glass, neon top edge and tech corner brackets (pure Views, no measuring)
export function Panel({ children, style, accent, glow, pad }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: string; glow?: boolean; pad?: number }) {
  const a = accent || N.cyan;
  return (
    <View style={[st.panel, pad !== undefined && { padding: pad }, glow && { shadowColor: a, shadowOpacity: .55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8, borderColor: a + '77' }, style]}>
      <LinearGradient colors={['rgba(40,26,110,0.55)', 'rgba(12,8,40,0.88)', 'rgba(5,3,18,0.95)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: .4, y: 1 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { height: '40%' }]} />
      {accent !== 'transparent' ? <LinearGradient pointerEvents="none" colors={['transparent', a, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.panelTop} /> : null}
      {accent !== 'transparent' ? <><View pointerEvents="none" style={[st.brk, { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2, borderColor: a }]} /><View pointerEvents="none" style={[st.brk, { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2, borderColor: a }]} /></> : null}
      {children}
    </View>
  );
}

// neon chamfered button (SVG plate sized by onLayout)
export function Btn({ label, onPress, colors, icon, style, small, disabled, sub, dark }: { label: string; onPress?: () => void; colors?: readonly string[]; icon?: any; style?: StyleProp<ViewStyle>; small?: boolean; disabled?: boolean; sub?: string; dark?: boolean }) {
  const cs = (colors || G.primary) as readonly string[];
  const h = small ? 46 : 58, k = small ? 10 : 14;
  const [w, setW] = React.useState(0); const gid = React.useMemo(() => 'bt' + Math.random().toString(36).slice(2, 8), []);
  return (
    <Press onPress={onPress} disabled={disabled} style={style}>
      <View style={[st.btn, { height: h }, small && { paddingHorizontal: 16 }]} onLayout={e => setW(e.nativeEvent.layout.width)}>
        {w ? (
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGrad id={gid} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={cs[0]} /><Stop offset=".55" stopColor={cs[1]} /><Stop offset="1" stopColor={cs[2] || cs[1]} /></SvgGrad>
              <SvgGrad id={gid + 'g'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#ffffff" stopOpacity={.42} /><Stop offset=".5" stopColor="#ffffff" stopOpacity={.06} /><Stop offset="1" stopColor="#ffffff" stopOpacity={0} /></SvgGrad>
            </Defs>
            <Path d={hexPath(w - 2, h - 2, k)} transform="translate(1 1)" fill={`url(#${gid})`} stroke="#ffffff" strokeOpacity={.55} strokeWidth={1.4} />
            <Path d={hexPath(w - 8, (h - 8) / 2, k * .6)} transform="translate(4 4)" fill={`url(#${gid}g)`} />
          </Svg>
        ) : null}
        {icon ? <Img src={icon} style={{ width: small ? 22 : 30, height: small ? 22 : 30, marginHorizontal: 8 }} /> : null}
        <View style={{ alignItems: 'center', flexShrink: 1 }}>
          <T s={label} n={1} style={[st.btnTxt, small && { fontSize: 14, letterSpacing: 1.5 }, dark && { color: '#06122a', textShadowRadius: 0 }]} />
          {sub ? <T s={sub} n={1} style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', fontFamily: F.head, letterSpacing: 1.5 }} /> : null}
        </View>
      </View>
    </Press>
  );
}

export function Pill({ icon, v, tint, onPress, plus }: { icon: any; v: string | number; tint?: string; onPress?: () => void; plus?: boolean }) {
  const body = (
    <View style={st.pill}>
      <Img src={icon} style={{ width: 22, height: 22, marginLeft: -4 }} />
      <T s={typeof v === 'number' ? v.toLocaleString('en-US') : v} style={{ fontFamily: F.head, fontSize: 12, marginHorizontal: 6, color: tint || C.text }} />
      {plus ? <View style={st.plus}><T s="+" style={{ fontFamily: F.title, fontSize: 12, color: '#04122a', marginTop: -1 }} /></View> : null}
    </View>
  );
  return onPress ? <Press onPress={onPress}>{body}</Press> : body;
}

export function Bar({ v, color, color2, h = 8 }: { v: number; color?: string; color2?: string; h?: number }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(Math.max(.02, Math.min(1, v)), { duration: 700, easing: Easing.out(Easing.cubic) }); }, [v]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: h, borderRadius: h, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.1)' }}>
      <Animated.View style={[{ height: '100%', borderRadius: h, overflow: 'hidden' }, a]}>
        <LinearGradient colors={[color2 || C.indigo, color || C.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '45%', backgroundColor: 'rgba(255,255,255,.3)' }} />
      </Animated.View>
    </View>
  );
}

export function Chip({ label, on, onPress, accent, icon }: { label: string; on?: boolean; onPress?: () => void; accent?: string; icon?: any }) {
  const a = accent || C.cyan;
  return (
    <Press onPress={onPress} style={[st.chip, on && { borderColor: a, backgroundColor: a + '2a', shadowColor: a, shadowOpacity: .6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }]}>
      {icon ? <Img src={icon} style={{ width: 18, height: 18, marginRight: 5 }} /> : null}
      <T s={label} style={{ fontFamily: F.bold, fontSize: 12, color: on ? '#fff' : C.dim }} />
    </Press>
  );
}

// segmented control with a sliding highlight
export function Segment({ items, value, onChange, accent }: { items: [string | number, string][]; value: string | number; onChange: (v: any) => void; accent?: string }) {
  const a = accent || C.cyan;
  const [w, setW] = React.useState(0);
  const idx = Math.max(0, items.findIndex(i => i[0] === value));
  const x = useSharedValue(idx);
  useEffect(() => { x.value = withSpring(idx, { damping: 18, stiffness: 220 }); }, [idx]);
  const n = items.length, cw = w / n;
  const rtl = isRTL(), dirK = rtl ? -1 : 1;
  const hl = useAnimatedStyle(() => ({ transform: [{ translateX: dirK * x.value * cw }] }));
  return (
    <View style={[st.seg, { flexDirection: rowDir() }]} onLayout={e => setW(e.nativeEvent.layout.width - 6)}>
      {w ? <Animated.View style={[st.segHl, { width: cw, borderColor: a, shadowColor: a }, rtl ? { right: 3 } : { left: 3 }, hl]}><LinearGradient colors={[a + '55', a + '18']} style={StyleSheet.absoluteFill} /></Animated.View> : null}
      {items.map(([k, l]) => (
        <Pressable key={String(k)} style={st.segItem} onPress={() => { sfx('ui'); buzz('light'); onChange(k); }}>
          <T s={l} style={{ fontFamily: F.bold, fontSize: 12, color: k === value ? '#fff' : C.dim }} />
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent?: string }) {
  const a = accent || C.cyan;
  const x = useSharedValue(on ? 1 : 0);
  useEffect(() => { x.value = withSpring(on ? 1 : 0, { damping: 16, stiffness: 260 }); }, [on]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(x.value, [0, 1], ['rgba(255,255,255,0.12)', a]) }));
  const kn = useAnimatedStyle(() => ({ transform: [{ translateX: 3 + x.value * 24 }] }));
  return (
    <Pressable hitSlop={8} onPress={() => { sfx('ui'); buzz(); onChange(!on); }}>
      <Animated.View style={[st.tgl, bg]}><Animated.View style={[st.knob, kn]} /></Animated.View>
    </Pressable>
  );
}

export const Enter = ({ children, i = 0, style }: { children: React.ReactNode; i?: number; style?: StyleProp<ViewStyle> }) => (
  <Animated.View entering={FadeInDown.delay(Math.min(i, 10) * 45).duration(380).springify().damping(18)} style={style}>{children}</Animated.View>
);

export function Title({ s, en, accent, right }: { s: string; en?: string; accent?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: isRTL() ? 'row' : 'row-reverse', alignItems: 'center', marginTop: 18, marginBottom: 10, paddingHorizontal: 16 }}>
      {right || null}
      <LinearGradient colors={['rgba(39,230,255,0)', 'rgba(39,230,255,.35)', 'rgba(164,59,255,.5)']} start={{ x: isRTL() ? 0 : 1, y: 0 }} end={{ x: isRTL() ? 1 : 0, y: 0 }} style={{ flex: 1, height: 1.5, marginHorizontal: 10 }} />
      <View style={{ width: 6, height: 6, transform: [{ rotate: '45deg' }], backgroundColor: accent || N.cyan, marginHorizontal: 6 }} />
      <View style={{ alignItems: isRTL() ? 'flex-end' : 'flex-start' }}>
        <T s={s} style={{ fontFamily: F.bold, fontSize: 16 }} />
        {en ? <T s={en} style={{ fontFamily: F.head, fontSize: 8, letterSpacing: 3, color: accent || C.cyan, marginTop: 1 }} /> : null}
      </View>
    </View>
  );
}

// slow breathing glow used behind hero art
export function Pulse({ size, color, style }: { size: number; color: string; style?: any }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  const a = useAnimatedStyle(() => ({ opacity: .35 + p.value * .4, transform: [{ scale: .9 + p.value * .12 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: size / 4, shadowOffset: { width: 0, height: 0 } }, style, a]} />;
}

export function Float({ children, amp = 6, dur = 2600, style, delay = 0 }: { children: React.ReactNode; amp?: number; dur?: number; style?: any; delay?: number }) {
  const p = useSharedValue(0);
  useEffect(() => { const t = setTimeout(() => { p.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true); }, delay); return () => clearTimeout(t); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: amp - p.value * amp * 2 }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

export const st = StyleSheet.create({
  panel: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(120,110,255,.28)', overflow: 'hidden', backgroundColor: 'rgba(6,4,22,.92)' },
  panelTop: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, opacity: .95 },
  brk: { position: 'absolute', width: 12, height: 12, opacity: .85 },
  btn: { height: 58, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 22 },
  btnGloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '52%' },
  btnTxt: { fontFamily: F.title, fontSize: 18, letterSpacing: 3, color: '#fff', textShadowColor: 'rgba(0,0,0,.45)', textShadowRadius: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 4, height: 32, borderRadius: 8, backgroundColor: 'rgba(8,5,28,.82)', borderWidth: 1, borderColor: 'rgba(39,230,255,.35)', marginLeft: 6 },
  plus: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', paddingHorizontal: 14, height: 36, borderRadius: 8, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginLeft: 8, backgroundColor: 'rgba(8,12,34,.7)' },
  seg: { flexDirection: 'row-reverse', height: 44, borderRadius: 10, padding: 3, backgroundColor: 'rgba(8,5,28,.85)', borderWidth: 1, borderColor: 'rgba(120,110,255,.3)' },
  segHl: { position: 'absolute', top: 3, bottom: 3, borderRadius: 8, borderWidth: 1, overflow: 'hidden', shadowOpacity: .6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tgl: { width: 54, height: 30, borderRadius: 15, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
});
