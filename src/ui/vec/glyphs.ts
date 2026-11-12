// Vector glyph library (64×64 box). Shared by the SVG icons (react-native-svg, menus) and the
// Skia hub scene (Skia.Path.MakeFromSVGString) so every menu graphic is code, not a bitmap.
//   body  — filled shapes (metal / neon gradient)
//   lines — stroked details drawn on top
//   c     — [light, dark] gradient colours

const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const star = (cx: number, cy: number, R: number, r: number, n = 5) => {
  let d = ''; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * q).toFixed(1)} ${(cy + Math.sin(a) * q).toFixed(1)}`; }
  return d + 'Z';
};
const gear = (cx: number, cy: number, R: number, r: number, n = 8) => {
  let d = ''; const st = Math.PI * 2 / n;
  for (let i = 0; i < n; i++) {
    const a = i * st, pts = [[a - st * .22, r], [a - st * .14, R], [a + st * .14, R], [a + st * .22, r], [a + st * .5, r]];
    for (const [aa, q] of pts) d += `${d ? 'L' : 'M'}${(cx + Math.cos(aa) * q).toFixed(1)} ${(cy + Math.sin(aa) * q).toFixed(1)}`;
  }
  return d + 'Z' + circ(cx, cy, r * .42);
};
export const hexPath = (w: number, h: number, k: number) => `M${k} 0H${w - k}L${w} ${k}V${h - k}L${w - k} ${h}H${k}L0 ${h - k}V${k}Z`;

export type Glyph = { body?: string[]; lines?: string[]; c: [string, string]; lc?: string; lw?: number; evenodd?: boolean };
export const GOLD: [string, string] = ['#fff1a8', '#d18a14'];
export const CYAN: [string, string] = ['#b8f8ff', '#1b8cff'];
export const VIOLET: [string, string] = ['#ecc8ff', '#7a3bff'];
export const SILVER: [string, string] = ['#ffffff', '#8aa0c8'];
export const RED: [string, string] = ['#ffc0c8', '#e0203f'];
export const GREEN: [string, string] = ['#c8ffe6', '#14b87a'];
export const PINK: [string, string] = ['#ffd0f4', '#e03bb8'];
export const ORANGE: [string, string] = ['#ffe0b0', '#ff7a1f'];

export const GLYPHS: Record<string, Glyph> = {
  coin: { body: [circ(32, 32, 26)], lines: [circ(32, 32, 19), 'M25 41V23h3.5l8 11.5V23H40v18h-3.5l-8-11.5V41Z'], c: GOLD, lc: '#7a4a00', lw: 2.2 },
  coins: { body: [circ(24, 38, 17), circ(40, 26, 17)], lines: [circ(40, 26, 11.5), 'M36 32V20h2.5l4 6.5V20H45v12h-2.5l-4-6.5V32Z'], c: GOLD, lc: '#7a4a00', lw: 2 },
  gem: { body: ['M14 24L24 11H40L50 24L32 55Z'], lines: ['M14 24H50M24 11L28 24L32 55M40 11L36 24L32 55M28 24L32 11L36 24'], c: CYAN, lc: '#e8fdff', lw: 1.6 },
  gift: { body: ['M12 28h40v26H12Z', 'M9 19h46v10H9Z'], lines: ['M32 19V54', 'M32 19C24 6 12 12 22 19M32 19C40 6 52 12 42 19'], c: PINK, lc: '#fff2a8', lw: 3.2 },
  gear: { body: [gear(32, 32, 27, 20, 8)], lines: [circ(32, 32, 8.4)], c: SILVER, lc: '#27e6ff', lw: 2, evenodd: true },
  home: { body: ['M8 31L32 10L56 31V55H41V40H23V55H8Z'], lines: ['M32 22V30'], c: CYAN, lc: '#ffffff', lw: 2 },
  shield: { body: ['M32 5L54 13V30C54 44 44 53 32 59C20 53 10 44 10 30V13Z'], lines: [star(32, 31, 11, 4.6)], c: CYAN, lc: '#ffffff', lw: 2 },
  ball: { body: [circ(32, 32, 26)], lines: ['M32 21L41.5 28L38 39H26L22.5 28Z', 'M32 21V7M41.5 28L55 24M38 39L46 51M26 39L18 51M22.5 28L9 24'], c: ['#ffffff', '#b9c6dd'], lc: '#0b1236', lw: 2.4 },
  chest: { body: ['M9 30H55V55H9Z', 'M9 30C9 15 55 15 55 30Z'], lines: ['M9 30H55M20 18V55M44 18V55', 'M28 34h8v9h-8Z'], c: GOLD, lc: '#5a3300', lw: 2.4 },
  cart: { body: [circ(24, 52, 5), circ(46, 52, 5)], lines: ['M6 12H15L22 42H49L56 20H17'], c: CYAN, lc: '#b8f8ff', lw: 4.5 },
  user: { body: [circ(32, 20, 12), 'M10 56C10 41 21 35 32 35C43 35 54 41 54 56Z'], c: CYAN },
  team: { body: [circ(22, 22, 9), circ(43, 20, 8), 'M4 54C4 42 12 37 22 37C32 37 40 42 40 54Z', 'M36 36C40 33 44 33 46 33C54 33 60 38 60 50H43C43 44 41 39 36 36Z'], c: VIOLET },
  trophy: { body: ['M19 8H45V24C45 34 39 40 32 40C25 40 19 34 19 24Z', 'M28 40h8v8h-8Z', 'M19 48H45V57H19Z'], lines: ['M19 14H11C11 24 15 28 20 29M45 14H53C53 24 49 28 44 29', star(32, 22, 7, 3)], c: GOLD, lc: '#fff6c8', lw: 2.6 },
  medal: { body: ['M20 5H29L34 22H25Z', 'M35 5H44L39 22H30Z', circ(32, 39, 16)], lines: [star(32, 39, 9, 3.8)], c: GOLD, lc: '#fff6c8', lw: 2 },
  crown: { body: ['M7 22L20 34L32 13L44 34L57 22L51 49H13Z', 'M13 52H51V58H13Z'], lines: [circ(32, 39, 3.4)], c: GOLD, lc: '#ff4f8a', lw: 3 },
  star: { body: [star(32, 33, 27, 11.5)], c: GOLD },
  calendar: { body: ['M9 14H55V55H9Z'], lines: ['M9 25H55', 'M21 8V18M43 8V18', 'M18 34h6M29 34h6M40 34h6M18 44h6M29 44h6'], c: CYAN, lc: '#04122a', lw: 3 },
  bell: { body: ['M32 7C22 7 18 15 18 25V37L11 46H53L46 37V25C46 15 42 7 32 7Z', 'M26 49a6 6 0 0 0 12 0Z'], c: GOLD },
  mega: { body: ['M8 25H19L45 11V53L19 39H8Z'], lines: ['M51 22C56 27 56 37 51 42', 'M19 39L24 55'], c: ORANGE, lc: '#ffe0b0', lw: 3.2 },
  tactics: { body: ['M7 9H57V55H7Z'], lines: ['M15 17L23 25M23 17L15 25', circ(44, 43, 5), 'M18 44C26 34 34 30 41 20M41 20H34M41 20V27'], c: GREEN, lc: '#ffffff', lw: 2.8 },
  goal: { body: ['M6 50V14H58V50H52V20H12V50Z'], lines: ['M12 26H52M12 33H52M12 40H52M20 20V50M28 20V50M36 20V50M44 20V50', circ(32, 50, 6)], c: SILVER, lc: '#9fefff', lw: 1.3 },
  shirt: { body: ['M22 7L32 12L42 7L57 17L51 29L46 26V57H18V26L13 29L7 17Z'], lines: ['M27 9C28 14 36 14 37 9', 'M26 33h12'], c: CYAN, lc: '#ffffff', lw: 2.4 },
  back: { lines: ['M40 12L20 32L40 52'], c: CYAN, lc: '#e8fbff', lw: 6 },
  next: { lines: ['M24 12L44 32L24 52'], c: CYAN, lc: '#e8fbff', lw: 6 },
  play: { body: ['M20 10L54 32L20 54Z'], c: CYAN },
  plus: { lines: ['M32 12V52M12 32H52'], c: GREEN, lc: '#eafff5', lw: 7 },
  close: { lines: ['M16 16L48 48M48 16L16 48'], c: SILVER, lc: '#e8fbff', lw: 5.5 },
  check: { lines: ['M12 33L26 47L52 17'], c: GREEN, lc: '#3dffb0', lw: 6.5 },
  lock: { body: ['M13 28H51V57H13Z'], lines: ['M21 28V20C21 7 43 7 43 20V28', 'M32 38V46'], c: SILVER, lc: '#c9d6f0', lw: 4.5 },
  globe: { body: [circ(32, 32, 26)], lines: ['M6 32H58M32 6C19 18 19 46 32 58M32 6C45 18 45 46 32 58M10 19H54M10 45H54'], c: CYAN, lc: '#e8fdff', lw: 2 },
  gamepad: { body: ['M17 19H47C56 19 61 30 59 41C57 51 48 53 44 45L40 39H24L20 45C16 53 7 51 5 41C3 30 8 19 17 19Z'], lines: ['M18 27V37M13 32H23', circ(44, 28, 2.6), circ(50, 34, 2.6)], c: CYAN, lc: '#04122a', lw: 3 },
  planet: { body: [circ(32, 32, 15)], lines: ['M4 36C2 29 61 19 60 27C59 35 6 44 4 36Z', circ(50, 12, 1.5), circ(12, 14, 1)], c: VIOLET, lc: '#ffd0f4', lw: 2.6 },
  duo: { body: [circ(20, 22, 9), circ(44, 22, 9), 'M3 54C3 42 11 36 20 36C29 36 37 42 37 54Z', 'M27 54C27 42 35 36 44 36C53 36 61 42 61 54Z'], c: GREEN },
  target: { body: [circ(32, 32, 26)], lines: [circ(32, 32, 17), circ(32, 32, 8)], c: ['#d6f1ff', '#3b82ff'], lc: '#ffffff', lw: 3.2 },
  bolt: { body: ['M37 4L13 36H29L25 60L51 26H35Z'], c: ORANGE },
  aim: { lines: [circ(32, 32, 19), 'M32 4V18M32 46V60M4 32H18M46 32H60', circ(32, 32, 3)], c: CYAN, lc: '#b8f8ff', lw: 3.2 },
  disc: { body: [circ(32, 32, 26)], lines: [circ(32, 32, 19), circ(32, 32, 9), 'M32 6V13M32 51V58'], c: ['#d0e4ff', '#3a4a7a'], lc: '#27e6ff', lw: 2.2 },
  field: { body: ['M9 5H55V59H9Z'], lines: ['M9 32H55', circ(32, 32, 8), 'M22 5V13H42V5M22 59V51H42V59'], c: GREEN, lc: '#e8fff2', lw: 2 },
  chat: { body: ['M7 11H57V45H29L16 56V45H7Z'], lines: ['M17 23H47M17 33H38'], c: CYAN, lc: '#04122a', lw: 3 },
  sun: { body: [circ(32, 32, 12)], lines: ['M32 4V12M32 52V60M4 32H12M52 32H60M12 12L18 18M46 46L52 52M52 12L46 18M18 46L12 52'], c: ORANGE, lc: '#ffd257', lw: 3.6 },
  moon: { body: ['M38 6A26 26 0 1 0 58 40A21 21 0 1 1 38 6Z'], lines: [circ(46, 18, 1.4)], c: ['#fffbe0', '#9fb3ff'], lc: '#ffffff', lw: 1 },
  lang: { body: [circ(32, 32, 26)], lines: ['M20 44L30 18H34L44 44M24 35H40'], c: VIOLET, lc: '#ffffff', lw: 3.4 },
  sound: { body: ['M8 24H19L34 11V53L19 40H8Z'], lines: ['M42 22C47 27 47 37 42 42M49 15C58 24 58 40 49 49'], c: CYAN, lc: '#b8f8ff', lw: 3.6 },
  music: { body: [circ(20, 48, 8), circ(46, 42, 8)], lines: ['M27 48V14L53 8V42'], c: VIOLET, lc: '#ecc8ff', lw: 4 },
  vibe: { body: ['M22 6H42V58H22Z'], lines: ['M12 20V44M6 26V38M52 20V44M58 26V38'], c: SILVER, lc: '#27e6ff', lw: 3 },
  sparkle: { body: [star(32, 32, 26, 6, 4), star(52, 12, 8, 2, 4)], c: VIOLET },
  info: { body: [circ(32, 32, 26)], lines: ['M32 29V46', circ(32, 20, 1.6)], c: CYAN, lc: '#04122a', lw: 5 },
  logout: { lines: ['M28 10H12V54H28', 'M26 32H56M46 22L56 32L46 42'], c: RED, lc: '#ffb0bc', lw: 4.5 },
  refresh: { lines: ['M52 30A20 20 0 1 1 44 16', 'M44 6V17H55'], c: CYAN, lc: '#b8f8ff', lw: 5 },
  trash: { body: ['M15 18H49L45 58H19Z'], lines: ['M10 14H54M26 8H38M26 26V50M38 26V50'], c: RED, lc: '#ffd0d6', lw: 3 },
  edit: { body: ['M44 8L56 20L24 52L10 56L14 42Z'], lines: ['M38 14L50 26'], c: CYAN, lc: '#04122a', lw: 3 },
  copy: { body: ['M20 18H50V58H20Z'], lines: ['M14 46V8H42'], c: SILVER, lc: '#9fefff', lw: 3.2 },
  share: { body: [circ(46, 14, 8), circ(16, 32, 8), circ(46, 50, 8)], lines: ['M22 28L40 18M22 36L40 46'], c: CYAN, lc: '#b8f8ff', lw: 3.6 },
  fire: { body: ['M32 4C40 18 50 24 50 40C50 52 42 60 32 60C22 60 14 52 14 40C14 30 20 24 24 16C26 24 30 26 32 26C32 18 30 12 32 4Z'], lines: ['M32 58C26 58 22 52 24 46C26 40 32 38 32 32C36 38 40 42 40 48C40 54 36 58 32 58Z'], c: ORANGE, lc: '#fff2a8', lw: 2 },
  ticket: { body: ['M6 18H58V28A5 5 0 0 0 58 38V48H6V38A5 5 0 0 0 6 28Z'], lines: ['M40 18V48'], c: PINK, lc: '#fff', lw: 2 },
  xp: { body: [star(32, 32, 26, 16, 8)], lines: ['M20 26L30 40M30 26L20 40M36 40V26H42C47 26 47 34 42 34H36'], c: GREEN, lc: '#04122a', lw: 3 },
  key: { body: [circ(20, 32, 12)], lines: ['M30 32H58M50 32V42M42 32V40', circ(20, 32, 4)], c: GOLD, lc: '#fff1a8', lw: 4 },
  bag: { body: ['M10 22H54L50 58H14Z'], lines: ['M22 22V16C22 6 42 6 42 16V22'], c: VIOLET, lc: '#ecc8ff', lw: 4 },
  rank: { body: ['M6 40H22V58H6Z', 'M24 24H40V58H24Z', 'M42 32H58V58H42Z'], lines: [star(32, 12, 7, 3)], c: CYAN, lc: '#ffd257', lw: 2.4 },
  inventory: { body: ['M8 8H29V29H8Z', 'M35 8H56V29H35Z', 'M8 35H29V56H8Z', 'M35 35H56V56H35Z'], c: VIOLET },
  wifi: { lines: ['M8 26C22 12 42 12 56 26M16 34C26 25 38 25 48 34M24 42C29 38 35 38 40 42', circ(32, 50, 2)], c: CYAN, lc: '#27e6ff', lw: 4.5 },
  clock: { body: [circ(32, 32, 26)], lines: ['M32 16V32L43 39'], c: CYAN, lc: '#04122a', lw: 4 },
  mic: { body: ['M24 8H40V36C40 46 24 46 24 36Z'], lines: ['M16 32C16 50 48 50 48 32M32 46V58M22 58H42'], c: CYAN, lc: '#b8f8ff', lw: 3.4 },
  search: { lines: [circ(27, 27, 17), 'M40 40L56 56'], c: CYAN, lc: '#b8f8ff', lw: 5 },
  flag: { body: ['M12 8H52L44 20L52 32H12Z'], lines: ['M12 6V60'], c: RED, lc: '#e8fbff', lw: 4 },
  stadium: { body: ['M4 30C4 18 60 18 60 30V48C60 56 4 56 4 48Z'], lines: ['M4 30C4 42 60 42 60 30', 'M14 14V24M50 14V24M32 10V20'], c: CYAN, lc: '#04122a', lw: 2.6 },
};
// aliases used by the old raster asset names (assets.ts maps every old key to one of these)
export const ALIAS: Record<string, string> = {
  x_ball: 'ball', c_ball: 'ball', x_bell: 'bell', c_bell: 'bell', x_chest: 'chest', c_chest: 'chest', x_coins: 'coins', c_coin: 'coin', coin: 'coin',
  x_crown: 'crown', crown: 'crown', x_gear: 'gear', c_gear: 'gear', i_gear: 'gear', r_gear: 'gear', x_gem: 'gem', c_gem: 'gem', gem: 'gem',
  x_gift: 'gift', c_gift: 'gift', i_gift: 'gift', b_gift: 'gift', x_home: 'home', i_home: 'home', x_medal: 'medal', x_player: 'shirt',
  x_shield: 'shield', c_shield: 'shield', x_star: 'star', c_star: 'star', b_star: 'star', r_star: 'star', x_statue: 'goal', x_tactics: 'tactics', c_tactics: 'tactics',
  x_team: 'team', c_team: 'team', x_trophy: 'trophy', c_trophy: 'trophy', i_trophy: 'trophy', b_trophy: 'trophy', cup: 'trophy', holotrophy: 'trophy',
  c_calendar: 'calendar', c_mega: 'mega', c_profile: 'user', c_stadium: 'stadium', i_cart: 'cart', r_back: 'back', btn_back: 'back', r_play: 'play', r_plus: 'plus',
  ticket: 'ticket', xp: 'xp', ball: 'ball', ballcrown: 'ball', chest: 'chest', portal_globe: 'globe', portal_gamepad: 'gamepad', portal_galaxy: 'planet',
  portal_friends: 'duo', portal_brain: 'target', portal_shop: 'cart', portal_profile: 'user', globe: 'globe', disc_3d: 'disc', disc_top: 'disc',
};
