// Larger code-drawn art: chests (4 rarities, open/closed), league emblems, NX logo, robot guide,
// result banners, mode portals, holo pad. Plus `vec()` tokens that replace the old raster asset map.
import React, { memo, useState } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SText } from 'react-native-svg';
import { Icon } from './Icon';
import { hexPath } from './glyphs';
import { RAR } from '../theme';
import { tr, isFa } from '../../i18n';

let uid = 0; const useId = (p: string) => React.useMemo(() => `${p}${++uid}`, []);

// ---------- chest ----------
const CH = [['#c9d6f0', '#3a4a6a'], ['#9ff4ff', '#0b4f9a'], ['#e3b8ff', '#4a1a8a'], ['#fff1a8', '#9a5a00'], ['#ffd0f4', '#8a1a6a']];
export const Chest = memo(function Chest({ size = 96, rarity = 0, open = false }: { size?: number; rarity?: number; open?: boolean }) {
  const id = useId('ch'), r = Math.max(0, Math.min(4, rarity)), [hi, lo] = CH[r], rc = RAR[r];
  return (
    <Svg width={size} height={size * 110 / 120} viewBox="0 0 120 110">
      <Defs>
        <LinearGradient id={id + 'b'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={lo} /><Stop offset="1" stopColor="#070418" /></LinearGradient>
        <LinearGradient id={id + 'm'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={hi} /><Stop offset="1" stopColor={lo} /></LinearGradient>
        <RadialGradient id={id + 'l'} cx="50%" cy="100%" r="80%"><Stop offset="0" stopColor={rc} stopOpacity={.9} /><Stop offset="1" stopColor={rc} stopOpacity={0} /></RadialGradient>
      </Defs>
      <Ellipse cx="60" cy="102" rx="50" ry="7" fill={rc} opacity={.25} />
      {open ? (
        <G>
          <Path d="M60 52L18 0H44ZM60 52L50 0H70ZM60 52L76 0H102Z" fill={`url(#${id}l)`} opacity={.85} />
          <Path d="M18 40C18 14 102 14 102 40L96 46C90 28 30 28 24 46Z" fill={`url(#${id}m)`} stroke={rc} strokeWidth={2} />
          <Ellipse cx="60" cy="54" rx="40" ry="8" fill={rc} opacity={.8} />
          <Circle cx="38" cy="22" r="2" fill="#fff" /><Circle cx="84" cy="16" r="2.5" fill="#fff" /><Circle cx="62" cy="8" r="1.6" fill="#fff" />
        </G>
      ) : (
        <G>
          <Path d="M14 56C14 26 106 26 106 56Z" fill={`url(#${id}b)`} stroke={rc} strokeWidth={2.4} />
          <Path d="M22 50C24 34 96 34 98 50" fill="none" stroke={hi} strokeOpacity={.35} strokeWidth={2} />
          <Path d="M30 30V56M90 30V56" stroke={`url(#${id}m)`} strokeWidth={7} />
        </G>
      )}
      <Rect x="14" y="54" width="92" height="46" rx="5" fill={`url(#${id}b)`} stroke={rc} strokeWidth={2.4} />
      <Path d="M30 54V100M90 54V100" stroke={`url(#${id}m)`} strokeWidth={7} />
      <Path d="M14 62H106" stroke={hi} strokeOpacity={.4} strokeWidth={1.5} />
      <Path d={hexPath(24, 26, 6)} transform="translate(48 60)" fill={`url(#${id}m)`} stroke="#fff" strokeOpacity={.6} />
      <Path d="M60 68a3 3 0 1 0 .1 0ZM58.6 72h2.8l1 7h-4.8Z" fill="#0b0626" />
    </Svg>
  );
});

// ---------- league emblem (7 tiers) ----------
const LG = [['#ffd0a8', '#a0582a'], ['#ffffff', '#8a98b8'], ['#fff1a8', '#c88a10'], ['#c8fbff', '#1fa8d8'], ['#ecc8ff', '#7a3bff'], ['#ffd0f4', '#d0249a'], ['#fff1a8', '#ff3d6e']];
export const LeagueEmblem = memo(function LeagueEmblem({ tier = 0, size = 56 }: { tier?: number; size?: number }) {
  const id = useId('lg'), t = Math.max(0, Math.min(6, tier)), [a, b] = LG[t];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2=".3" y2="1"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient></Defs>
      {t >= 3 ? <Path d="M10 22C2 30 4 44 14 50L20 40C14 36 12 30 14 24ZM54 22C62 30 60 44 50 50L44 40C50 36 52 30 50 24Z" fill={`url(#${id})`} opacity={.85} /> : null}
      <Path d="M32 6L50 13V30C50 43 42 51 32 57C22 51 14 43 14 30V13Z" fill={`url(#${id})`} stroke="#fff" strokeOpacity={.6} strokeWidth={1.4} />
      <Path d="M32 12L45 17V30C45 40 39 46 32 50C25 46 19 40 19 30V17Z" fill="#0a0626" opacity={.55} />
      {Array.from({ length: Math.min(3, t % 3 + 1) }).map((_, i, arr) => <Path key={i} d={`M24 ${26 + i * 7}L32 ${31 + i * 7}L40 ${26 + i * 7}`} fill="none" stroke={a} strokeWidth={3} strokeLinecap="round" transform={`translate(0 ${(3 - arr.length) * 3.5})`} />)}
      {t >= 5 ? <Path d="M20 8L25 13L32 4L39 13L44 8L42 18H22Z" fill="#ffd257" stroke="#fff" strokeOpacity={.6} /> : null}
    </Svg>
  );
});

// ---------- NX logo ----------
export const NxLogo = memo(function NxLogo({ size = 64 }: { size?: number }) {
  const id = useId('nx');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#27e6ff" /><Stop offset="1" stopColor="#a43bff" /></LinearGradient></Defs>
      <Path d="M32 3L57 17.5V46.5L32 61L7 46.5V17.5Z" fill="#07041a" stroke={`url(#${id})`} strokeWidth={3} />
      <Path d="M32 9L52 20.5V43.5L32 55L12 43.5V20.5Z" fill="none" stroke={`url(#${id})`} strokeOpacity={.35} strokeWidth={1} />
      <Path d="M17 44V20H22L31 34V20H35V44H30L21 30V44Z" fill={`url(#${id})`} />
      <Path d="M36 20H41L44 26L47 20H52L46.5 32L52 44H47L44 38L41 44H36L41.5 32Z" fill="#e8fbff" />
    </Svg>
  );
});

// ---------- robot guide ----------
export const Robot = memo(function Robot({ size = 84, mood = 0 }: { size?: number; mood?: number }) {
  const id = useId('rb');
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 80 88">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#f2f6ff" /><Stop offset="1" stopColor="#8a9cc8" /></LinearGradient>
        <LinearGradient id={id + 'v'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#0a1640" /><Stop offset="1" stopColor="#02010a" /></LinearGradient>
      </Defs>
      <Ellipse cx="40" cy="84" rx="20" ry="3.5" fill="#27e6ff" opacity={.35} />
      <Path d="M40 4V12" stroke="#a43bff" strokeWidth={2.4} /><Circle cx="40" cy="4" r="3.2" fill="#ff4fd8" />
      <Rect x="12" y="12" width="56" height="40" rx="16" fill={`url(#${id})`} stroke="#ffffff" strokeOpacity={.7} />
      <Rect x="18" y="20" width="44" height="24" rx="11" fill={`url(#${id}v)`} stroke="#27e6ff" strokeOpacity={.6} />
      {mood ? <Path d="M26 32Q31 27 36 32M44 32Q49 27 54 32" stroke="#27e6ff" strokeWidth={3.4} strokeLinecap="round" fill="none" />
        : <G><Ellipse cx="31" cy="32" rx="4.2" ry="5" fill="#27e6ff" /><Ellipse cx="49" cy="32" rx="4.2" ry="5" fill="#27e6ff" /><Circle cx="32.5" cy="30" r="1.4" fill="#fff" /><Circle cx="50.5" cy="30" r="1.4" fill="#fff" /></G>}
      <Rect x="6" y="26" width="7" height="14" rx="3" fill="#a43bff" /><Rect x="67" y="26" width="7" height="14" rx="3" fill="#a43bff" />
      <Path d="M26 54H54L50 74H30Z" fill={`url(#${id})`} stroke="#fff" strokeOpacity={.6} />
      <Circle cx="40" cy="63" r="4" fill="#27e6ff" opacity={.9} />
    </Svg>
  );
});

// ---------- result banner ----------
export const ResultBanner = memo(function ResultBanner({ kind, width = 280 }: { kind: 'victory' | 'defeat' | 'draw'; width?: number }) {
  const id = useId('rs'); const c = kind === 'victory' ? ['#fff1a8', '#d18a14', '#ffd257'] : kind === 'defeat' ? ['#ffc0c8', '#a0102f', '#ff4a5a'] : ['#b8f8ff', '#1b6cff', '#27e6ff'];
  const label = kind === 'victory' ? tr('پیروزی', 'VICTORY') : kind === 'defeat' ? tr('شکست', 'DEFEAT') : tr('مساوی', 'DRAW');
  return (
    <Svg width={width} height={width * .5} viewBox="0 0 200 100">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c[0]} /><Stop offset="1" stopColor={c[1]} /></LinearGradient></Defs>
      <Path d="M8 40L30 30L24 50L30 70L8 60L16 50Z M192 40L170 30L176 50L170 70L192 60L184 50Z" fill={`url(#${id})`} opacity={.85} />
      <Path d={hexPath(150, 52, 14)} transform="translate(25 24)" fill="#0a0626" stroke={`url(#${id})`} strokeWidth={3.5} />
      <Path d={hexPath(140, 42, 11)} transform="translate(30 29)" fill="none" stroke={c[2]} strokeOpacity={.4} />
      {kind === 'victory' ? <Path d="M82 22L90 8L100 18L110 8L118 22Z" fill="#ffd257" /> : null}
      <SText x="100" y={isFa() ? 59 : 57} fontSize={isFa() ? 24 : 19} fontFamily={isFa() ? 'Vazirmatn_800ExtraBold' : 'Orbitron_900Black'} fill={c[0]} textAnchor="middle" letterSpacing={isFa() ? 0 : 2}>{label}</SText>
    </Svg>
  );
});

// ---------- mode portal (Setup header, cards) ----------
export const ModeArt = memo(function ModeArt({ icon, color, size = 120 }: { icon: string; color: string; size?: number }) {
  const id = useId('ma');
  return (
    <View style={{ width: size, height: size * 1.1, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 100 110" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={.35} /><Stop offset="1" stopColor="#05020f" stopOpacity={.95} /></LinearGradient>
          <RadialGradient id={id + 'r'} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color} stopOpacity={.55} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient>
        </Defs>
        <Ellipse cx="50" cy="100" rx="40" ry="8" fill={`url(#${id}r)`} />
        <Path d="M50 4L90 24V76L50 96L10 76V24Z" fill={`url(#${id})`} stroke={color} strokeWidth={2.4} />
        <Path d="M50 12L82 28V72L50 88L18 72V28Z" fill="none" stroke={color} strokeOpacity={.4} />
        <Ellipse cx="50" cy="96" rx="34" ry="5" fill="none" stroke={color} strokeWidth={1.6} opacity={.8} />
      </Svg>
      <Icon name={icon} size={size * .46} style={{ marginBottom: size * .08 }} />
    </View>
  );
});

// ---------- holo pad (pedestal) ----------
export const HoloPad = memo(function HoloPad({ width = 240, color = '#27e6ff' }: { width?: number; color?: string }) {
  const id = useId('hp');
  return (
    <Svg width={width} height={width * .36} viewBox="0 0 200 72">
      <Defs><RadialGradient id={id} cx="50%" cy="40%" r="60%"><Stop offset="0" stopColor={color} stopOpacity={.55} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
      <Ellipse cx="100" cy="30" rx="96" ry="26" fill={`url(#${id})`} />
      <Ellipse cx="100" cy="30" rx="80" ry="18" fill="#0a0626" stroke={color} strokeWidth={2} />
      <Ellipse cx="100" cy="30" rx="64" ry="13" fill="none" stroke="#a43bff" strokeOpacity={.7} strokeDasharray="6 5" />
      <Path d="M20 30V44C20 54 180 54 180 44V30" fill="none" stroke={color} strokeOpacity={.4} />
    </Svg>
  );
});

// ---------- chamfered neon frame (measured, SVG background) ----------
export function Chamfer({ children, style, k = 12, color = '#27e6ff', color2 = '#a43bff', fill = ['rgba(22,16,70,.92)', 'rgba(6,4,22,.96)'], glow = true, brackets = true, strokeW = 1.6 }:
  { children?: React.ReactNode; style?: StyleProp<ViewStyle>; k?: number; color?: string; color2?: string; fill?: [string, string]; glow?: boolean; brackets?: boolean; strokeW?: number }) {
  const [sz, setSz] = useState<{ w: number; h: number } | null>(null); const id = useId('cf');
  return (
    <View style={style} onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; if (!sz || Math.abs(sz.w - w) > .5 || Math.abs(sz.h - h) > .5) setSz({ w, h }); }}>
      {sz ? (
        <Svg width={sz.w} height={sz.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={fill[0]} /><Stop offset="1" stopColor={fill[1]} /></LinearGradient>
            <LinearGradient id={id + 's'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={color} /><Stop offset="1" stopColor={color2} /></LinearGradient>
          </Defs>
          {glow ? <Path d={hexPath(sz.w - 2, sz.h - 2, k)} transform="translate(1 1)" fill="none" stroke={color} strokeOpacity={.18} strokeWidth={5} /> : null}
          <Path d={hexPath(sz.w - 2, sz.h - 2, k)} transform="translate(1 1)" fill={`url(#${id})`} stroke={`url(#${id}s)`} strokeWidth={strokeW} />
          <Path d={`M${k + 6} 3H${sz.w - k - 6}`} stroke="#ffffff" strokeOpacity={.22} strokeWidth={1} />
          {brackets ? <Path d={`M3 ${k + 10}V${k + 2}L${k + 2} 3H${k + 10}M${sz.w - 3} ${sz.h - k - 10}V${sz.h - k - 2}L${sz.w - k - 2} ${sz.h - 3}H${sz.w - k - 10}`} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" /> : null}
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

// ---------- vector tokens (replace the old raster asset map) ----------
export type VecToken = { __vec: string; tier?: number; rarity?: number; open?: boolean; banner?: 'victory' | 'defeat' | 'draw' };
export const vec = (name: string, o: Omit<VecToken, '__vec'> = {}): VecToken => ({ __vec: name, ...o });
export const isVec = (s: any): s is VecToken => !!s && typeof s === 'object' && typeof s.__vec === 'string';

// renders a token at the size given by an <Img> style
export const VecArt = memo(function VecArt({ t, style }: { t: VecToken; style?: any }) {
  const f = StyleSheet.flatten(style) || {}; const w = typeof f.width === 'number' ? f.width : 40, h = typeof f.height === 'number' ? f.height : w;
  const box: any = { width: w, height: h, alignItems: 'center', justifyContent: 'center', opacity: f.opacity, position: f.position, left: f.left, right: f.right, top: f.top, bottom: f.bottom, margin: f.margin, marginTop: f.marginTop, marginBottom: f.marginBottom, marginLeft: f.marginLeft, marginRight: f.marginRight, marginHorizontal: f.marginHorizontal, marginVertical: f.marginVertical, transform: f.transform, zIndex: f.zIndex };
  const s = Math.min(w, h);
  let node: React.ReactNode;
  switch (t.__vec) {
    case 'chestArt': node = <Chest size={s} rarity={t.rarity ?? 0} open={t.open} />; break;
    case 'league': node = <LeagueEmblem size={s} tier={t.tier ?? 0} />; break;
    case 'nx': node = <NxLogo size={s} />; break;
    case 'robot': node = <Robot size={s * .9} />; break;
    case 'banner': node = <ResultBanner kind={t.banner || 'draw'} width={w} />; break;
    case 'pad': node = <HoloPad width={w} />; break;
    case 'none': node = null; break;
    default: node = <Icon name={t.__vec} size={s} />;
  }
  return <View style={box} pointerEvents="none">{node}</View>;
});
