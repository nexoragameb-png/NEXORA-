import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { SFX } from './game/assets';

export type Key = 'ui' | 'hitb' | 'hitp' | 'goal' | 'post' | 'roar' | 'whistle' | 'final' | 'wall' | 'crowd' | 'music' | 'ready' | 'chat' | 'join' | 'leave' | 'win' | 'lose' | 'tick';
const MAP: Record<Key, [string, number, number]> = {
  // key: [file, volume, pool size]
  ui: ['select', .55, 2], hitb: ['hit_ball', .9, 3], hitp: ['hit_piece', .7, 3], goal: ['goal', .9, 1], post: ['ballHitsThePost', .8, 1],
  roar: ['goalHappened-01', .7, 1], whistle: ['startWistle', .8, 1], final: ['gameIsFinishedWistle', .8, 1], wall: ['BallHit-01', .55, 2],
  crowd: ['crowd-03', .25, 1], music: ['music', .35, 1],
  ready: ['nx_ready', .7, 1], chat: ['nx_chat', .55, 2], join: ['nx_join', .6, 1], leave: ['nx_leave', .5, 1], win: ['nx_win', .8, 1], lose: ['nx_lose', .75, 1], tick: ['nx_tick', .45, 2],
};

const pools: Partial<Record<Key, { list: AudioPlayer[]; i: number }>> = {};
const last: Partial<Record<Key, number>> = {};
let enabled = { sound: true, music: true, haptics: true, volume: 1 };
let inited = false;

export function initSound() {
  if (inited) return; inited = true;
  setAudioModeAsync({ playsInSilentMode: true } as any).catch(() => {});
  (Object.keys(MAP) as Key[]).forEach(k => {
    const [file, vol, n] = MAP[k]; const src = SFX[file]; if (!src) return;
    const list: AudioPlayer[] = [];
    for (let i = 0; i < n; i++) { try { const p = createAudioPlayer(src); p.volume = vol; if (k === 'music' || k === 'crowd') p.loop = true; list.push(p); } catch { } }
    pools[k] = { list, i: 0 };
  });
}

export function setAudioPrefs(p: { sound: boolean; music: boolean; haptics: boolean; volume?: number }) {
  enabled = { ...p, volume: Math.max(0, Math.min(1, p.volume ?? 1)) };
  // loops follow the master volume live
  for (const k of ['music', 'crowd'] as const) { const pl = pools[k]?.list[0]; if (pl) { try { pl.volume = MAP[k][1] * enabled.volume; } catch { } } }
  if (!enabled.music || !enabled.sound || enabled.volume <= 0) stopLoop('music');
}

export function sfx(k: Key, vol = 1) {
  if (!enabled.sound || enabled.volume <= 0) return; const pool = pools[k]; if (!pool || !pool.list.length) return;
  const now = Date.now(); if (k !== 'goal' && now - (last[k] || 0) < 45) return; last[k] = now;
  const p = pool.list[pool.i]; pool.i = (pool.i + 1) % pool.list.length;
  try { p.volume = Math.min(1, MAP[k][1] * Math.max(.15, vol) * enabled.volume); p.seekTo(0).catch?.(() => {}); p.play(); } catch { }
}

export function playLoop(k: 'music' | 'crowd') {
  if (!enabled.sound || enabled.volume <= 0 || (k === 'music' && !enabled.music)) return;
  const p = pools[k]?.list[0]; if (!p) return; try { if (!p.playing) p.play(); } catch { }
}
export function stopLoop(k: 'music' | 'crowd') { const p = pools[k]?.list[0]; if (!p) return; try { p.pause(); } catch { } }

export function buzz(kind: 'light' | 'medium' | 'heavy' | 'success' = 'light') {
  if (!enabled.haptics || Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch { }
}
