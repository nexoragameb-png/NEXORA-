import { LEGACY_DISC, Team, TEAMS, teamPrice } from './data';
export const teamKey = (t: Team) => t.key;
const BY_ID = new Map(TEAMS.map(t => [t.id, t] as const));
export const DEFAULT_TEAM = BY_ID.get('club0') || TEAMS[0];
export const teamById = (id?: string | null) => (id && (BY_ID.get(id) || BY_ID.get(LEGACY_DISC[id]))) || DEFAULT_TEAM;
export const isDeluxe = (t: Team) => t.tier === 'dlx';
export const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };
// cosmetic card stats (do not affect physics, except VIP speed bonus which the engine applies)
export const cardStats = (seed: string) => { const h = hash(seed); return { power: 60 + (h % 37), control: 55 + ((h >> 6) % 42), speed: 58 + ((h >> 12) % 40), spin: 50 + ((h >> 18) % 46) }; };
// rarity from tier + price: 0 common · 1 rare · 2 epic · 3 legendary (top standard) · 4 DELUXE
export const rarity = (t: Team) => { if (t.tier === 'dlx') return 4; const g = teamPrice(t); return g >= 220 ? 3 : g >= 180 ? 2 : g > 0 ? 1 : 0; };
export const RARITY = [{ n: 'COMMON', fa: 'معمولی', c: '#8ea3d6' }, { n: 'RARE', fa: 'کمیاب', c: '#4fe3ff' }, { n: 'EPIC', fa: 'حماسی', c: '#b46bff' }, { n: 'LEGENDARY', fa: 'افسانه‌ای', c: '#ffd257' }, { n: 'DELUXE', fa: 'دلوکس', c: '#ff7ae0' }];
