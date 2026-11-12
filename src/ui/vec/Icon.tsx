// SVG icon renderer: metallic gradient body + soft neon glow + crisp detail lines. ~1–2 KB of path data
// per icon instead of a 25–60 KB bitmap, sharp at any size, recolourable.
import React, { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { ALIAS, GLYPHS, hexPath } from './glyphs';

let uid = 0;
export type IconProps = { name: string; size?: number; c?: [string, string]; glow?: boolean; plate?: boolean | string; style?: any; opacity?: number };

export const Icon = memo(function Icon({ name, size = 28, c, glow = true, plate, style, opacity = 1 }: IconProps) {
  const g = GLYPHS[ALIAS[name] || name] || GLYPHS.star;
  const col = c || g.c, id = React.useMemo(() => `ic${++uid}`, []);
  const fr = g.evenodd ? 'evenodd' : 'nonzero';
  const pc = typeof plate === 'string' ? plate : col[1];
  return (
    <Svg width={size} height={size} viewBox={plate ? '-10 -10 84 84' : '-3 -3 70 70'} style={style} opacity={opacity}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={col[0]} />
          <Stop offset="1" stopColor={col[1]} />
        </LinearGradient>
        {plate ? (
          <LinearGradient id={id + 'p'} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1a1450" />
            <Stop offset="1" stopColor="#07041a" />
          </LinearGradient>
        ) : null}
      </Defs>
      {plate ? (
        <G>
          <Path d={hexPath(84, 84, 16)} transform="translate(-10 -10)" fill={`url(#${id}p)`} stroke={pc} strokeWidth={2.2} strokeOpacity={.9} />
          <Path d={hexPath(76, 76, 13)} transform="translate(-6 -6)" fill="none" stroke={pc} strokeWidth={1} strokeOpacity={.35} />
        </G>
      ) : null}
      {glow ? (
        <G opacity={.3}>
          {g.body?.map((d, i) => <Path key={'g' + i} d={d} fill="none" stroke={col[1]} strokeWidth={7} strokeLinejoin="round" fillRule={fr} />)}
          {g.lines?.map((d, i) => <Path key={'gl' + i} d={d} fill="none" stroke={col[1]} strokeWidth={(g.lw || 2.4) + 5} strokeLinecap="round" strokeLinejoin="round" />)}
        </G>
      ) : null}
      {g.body?.map((d, i) => <Path key={'b' + i} d={d} fill={`url(#${id})`} fillRule={fr} stroke="#ffffff" strokeOpacity={.55} strokeWidth={1.3} strokeLinejoin="round" />)}
      {g.lines?.map((d, i) => <Path key={'l' + i} d={d} fill="none" stroke={g.lc || '#ffffff'} strokeWidth={g.lw || 2.4} strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  );
});
