import { isFa, num } from '../i18n';
export const C = {
  bg: '#030614',
  bg2: '#060b22',
  panel: 'rgba(14,22,58,0.78)',
  panel2: 'rgba(8,12,34,0.9)',
  glass: 'rgba(14,24,64,0.62)',
  line: 'rgba(110,170,255,0.24)',
  lineHi: 'rgba(120,220,255,0.75)',
  cyan: '#4fe3ff',
  sky: '#7fc8ff',
  blue: '#3b82ff',
  indigo: '#6d5bff',
  violet: '#a35bff',
  pink: '#ff4fa3',
  gold: '#ffd257',
  orange: '#ff8a3a',
  red: '#ff4a5a',
  green: '#3dffa8',
  text: '#eef4ff',
  dim: '#93a7d8',
  dim2: '#5f6f9e',
};

export const F = {
  title: 'Orbitron_900Black',
  head: 'Orbitron_700Bold',
  body: 'Exo2_600SemiBold',
  bold: 'Exo2_800ExtraBold',
  fa: 'Vazirmatn_500Medium',
  faB: 'Vazirmatn_800ExtraBold',
};

// gradient presets (always 3 stops so LinearGradient typing stays happy)
export const G = {
  primary: [C.cyan, '#5b8cff', C.violet] as const,
  gold: ['#8a5200', '#d39420', '#ffe08a'] as const,
  green: ['#0a6b4a', '#16b77a', '#5dffbf'] as const,
  red: ['#5a0f24', '#a3203f', '#ff5b74'] as const,
  dark: ['#151f4a', '#1d2b63', '#2a3f86'] as const,
  violet: ['#3a1d8a', '#6d3bff', '#c08bff'] as const,
};

// numbers follow the UI language (Persian digits in fa, Latin in en)
export const fa = (n: number) => num(n);
export const faNum = (s: string | number) => (isFa() ? String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]) : String(s));

// v3 neon palette (reference hub): cyan #27e6ff, purple #a43bff, deep space #02010a
export const N = {
  cyan: '#27e6ff', purple: '#a43bff', pink: '#ff4fd8', ink: '#05020f', deep: '#02010a', text: '#e8fbff',
  glass: 'rgba(10,8,34,.78)', glass2: 'rgba(16,12,52,.9)', edge: 'rgba(39,230,255,.55)', edge2: 'rgba(164,59,255,.55)',
};
// rarity colours (common / rare / epic / legendary / deluxe)
export const RAR = ['#9fb3d9', '#27e6ff', '#b46bff', '#ffd257', '#ff7ae0'] as const;
