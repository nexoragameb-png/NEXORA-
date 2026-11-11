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

export const fa = (n: number) => n.toLocaleString('fa-IR');
export const faNum = (s: string | number) => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
