// Bilingual UI (Persian / English).
//  * tr(fa, en)       — new code passes both strings.
//  * xl(s)            — legacy Persian literals are translated through the EN dictionary (src/i18n_en.ts);
//                       numbers inside a string are matched as {0}, {1}… so "روز ۳" finds "روز {0}" → "Day 3".
//  * The active language is a module value set by the shell before it renders; switching language
//    remounts the whole tree (see App.tsx), so plain functions are enough — no context lookups per string.
import { EN } from './i18n_en';

export type Lang = 'fa' | 'en';
let LANG: Lang = 'fa';
export const getLang = () => LANG;
export const setLang = (l: Lang) => { LANG = l; };
export const isFa = () => LANG === 'fa';
export const isRTL = () => LANG === 'fa';

// device default: Persian for fa / ps / ku-Arab locales, English otherwise
export function deviceLang(): Lang {
  try {
    const loc = (Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
    return /^(fa|ps|prs|ckb|ku)/.test(loc) ? 'fa' : 'en';
  } catch { return 'fa'; }
}

export const tr = (fa: string, en: string) => (LANG === 'fa' ? fa : en);

const FA_RX = /[\u0600-\u06FF]/;
const DIG = /[0-9\u06F0-\u06F9\u0660-\u0669]+(?:[.,٬٫][0-9\u06F0-\u06F9\u0660-\u0669]+)*/g;
const toLatin = (s: string) => s.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)).replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/٬/g, ',').replace(/٫/g, '.');
const cache = new Map<string, string>();

export function xl(s: string): string {
  if (LANG === 'fa' || !FA_RX.test(s)) return s;
  const hit = cache.get(s); if (hit !== undefined) return hit;
  let out = EN[s];
  if (out === undefined) {
    const nums: string[] = [];
    const key = s.replace(DIG, m => { nums.push(toLatin(m)); return `{${nums.length - 1}}`; });
    const tpl = EN[key];
    if (tpl !== undefined) out = tpl.replace(/\{(\d+)\}/g, (_, i) => nums[+i] ?? '');
    else out = matchTemplate(s) ?? translateParts(s);
  }
  if (cache.size > 4000) cache.clear();
  cache.set(s, out); return out;
}

// templates whose placeholders hold text (names, labels): "{0} باز شد!" ← "Barcelona باز شد!"
let TPL: [RegExp, string, number[]][] | null = null;
function matchTemplate(s: string): string | null {
  if (!TPL) {
    TPL = [];
    for (const k in EN) {
      if (!k.includes('{0}')) continue;
      const order: number[] = [];
      const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d+)\}/g, (_, i) => { order.push(+i); return '(.+?)'; });
      try { TPL.push([new RegExp('^' + src + '$'), EN[k], order]); } catch { }
    }
  }
  for (const [rx, en, order] of TPL) {
    const m = rx.exec(s); if (!m) continue;
    const vals: Record<number, string> = {}; order.forEach((ix, j) => { const v = m[j + 1]; vals[ix] = FA_RX.test(v) ? xl(v) : toLatin(v); });
    return en.replace(/\{(\d+)\}/g, (_, i) => vals[+i] ?? '');
  }
  return null;
}

// fall back to translating " · "-separated parts on their own (lots of strings are built like "a · b")
function translateParts(s: string) {
  if (!s.includes(' · ')) return toLatin(s);
  return s.split(' · ').map(p => (FA_RX.test(p) ? xlPart(p) : toLatin(p))).join(' · ');
}
function xlPart(p: string) {
  const t = p.trim(); if (EN[t] !== undefined) return EN[t];
  const nums: string[] = []; const key = t.replace(DIG, m => { nums.push(toLatin(m)); return `{${nums.length - 1}}`; });
  const tpl = EN[key]; return tpl !== undefined ? tpl.replace(/\{(\d+)\}/g, (_, i) => nums[+i] ?? '') : toLatin(p);
}

// number formatting follows the language
export const num = (n: number) => (LANG === 'fa' ? n.toLocaleString('fa-IR') : n.toLocaleString('en-US'));
