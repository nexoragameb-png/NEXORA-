// Disc catalog (gem prices + power/accuracy stats) and the signed-in user's inventory.
// The catalog is public and cached on disk so offline matches use the real stats too.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Disc, errFa, rpc, supabase } from './supabase';
import { useAuth } from './auth';
import type { DiscStats } from '../game/engine';
import { DISC_META } from '../game/data';
import { useStore } from '../store';
import { num, tr } from '../i18n';

const KEY = 'nexora.discs.v1';
let catalog: Record<string, Disc> = {};
// fallback stats (deterministic) until the catalog has loaded once
const fallback = (id: string): DiscStats => { const m = DISC_META[id] || DISC_META.club0; return { power: m[1], accuracy: m[2] }; };
// v3: stats always come from the bundled table (the Deluxe tier must out-rate every standard disc,
// and online matches are host-authoritative so both sides already use the host's numbers)
export const discStats = (id?: string | null): DiscStats => fallback(id && DISC_META[id] ? id : 'club0');
// a disc the server catalog does not know yet (v3 additions until docs/discs_v3_catalog.sql is applied)
// is unlocked locally with coins instead of server gems
export const onServer = (id: string) => !!catalog[id];
export const COIN_RATE = 15;
export const localCoinPrice = (id: string) => (DISC_META[id]?.[0] ?? 0) * COIN_RATE;
export const discPrice = (id: string) => catalog[id]?.price_gems ?? 0;
export const isFreeDisc = (id: string) => (catalog[id] ? catalog[id].price_gems === 0 : (DISC_META[id]?.[0] ?? 1) === 0);

type Ctx = {
  catalog: Record<string, Disc>; loaded: boolean; owned: Set<string>; equipped: string | null;
  has: (id: string) => boolean;
  buy: (id: string) => Promise<{ ok: boolean; error?: string; gems?: number }>;
  equip: (id: string) => Promise<{ ok: boolean; error?: string }>;
};
const DiscCtx = createContext<Ctx>(null as any);
export const useDiscs = () => useContext(DiscCtx);

export function DiscProvider({ children }: { children: React.ReactNode }) {
  const { uid, profile } = useAuth();
  const [cat, setCat] = useState<Record<string, Disc>>(catalog);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(s => { if (s && alive && !Object.keys(catalog).length) { try { catalog = JSON.parse(s); setCat(catalog); } catch { } } }).catch(() => {});
    supabase.from('discs').select('*').then(({ data }) => {
      if (!alive || !data?.length) return;
      const m: Record<string, Disc> = {}; for (const d of data as Disc[]) m[d.id] = d;
      catalog = m; setCat(m); AsyncStorage.setItem(KEY, JSON.stringify(m)).catch(() => {});
    }, () => {});
    return () => { alive = false; };
  }, [uid]);

  useEffect(() => {
    if (!uid) { setOwned(new Set()); return; }
    let alive = true;
    const load = () => supabase.from('inventory').select('disc_id').eq('user_id', uid).then(({ data }) => { if (alive && data) setOwned(new Set(data.map((r: any) => r.disc_id))); }, () => {});
    load();
    const ch = supabase.channel(`inv:${uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `user_id=eq.${uid}` }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [uid]);

  const has = useCallback((id: string) => isFreeDisc(id) || owned.has(id), [owned, cat]);
  const buy = useCallback(async (id: string) => {
    try { const g = await rpc<number>('buy_disc', { p_disc: id }); setOwned(o => new Set(o).add(id)); return { ok: true, gems: g }; }
    catch (e) { return { ok: false, error: errFa(e) }; }
  }, []);
  const equip = useCallback(async (id: string) => {
    try { await rpc('equip_disc', { p_disc: id }); return { ok: true }; } catch (e) { return { ok: false, error: errFa(e) }; }
  }, []);
  const v = useMemo(() => ({ catalog: cat, loaded: Object.keys(cat).length > 0, owned, equipped: profile?.equipped_disc ?? null, has, buy, equip }), [cat, owned, profile?.equipped_disc, has, buy, equip]);
  return <DiscCtx.Provider value={v}>{children}</DiscCtx.Provider>;
}

// buy (if needed) + equip a disc with the full online flow; returns true when equipped
export function useBuyDisc(toast: (m: string, k?: string) => void, onEquipped?: (id: string) => void) {
  const dz = useDiscs(); const auth = useAuth();
  return useCallback(async (id: string, name: string) => {
    if (!auth.uid) { const u = await auth.ensure().catch(() => null); if (!u) { toast('برای خرید دیسک باید آنلاین باشی', 'err'); return false; } }
    if (!dz.has(id)) {
      const price = dz.catalog[id]?.price_gems ?? 0, g = auth.profile?.gems ?? 0;
      if (auth.profile && g < price) { toast(`${(price - g).toLocaleString('fa-IR')} الماس کم داری · چالش‌ها، فصل و تورنمنت‌ها الماس می‌دهند`, 'err'); return false; }
      const r = await dz.buy(id); if (!r.ok) { toast(r.error!, 'err'); return false; }
      toast(`${name} باز شد!`, 'ok');
    }
    const e = await dz.equip(id); if (!e.ok) { toast(e.error!, 'err'); return false; }
    onEquipped?.(id); return true;
  }, [dz, auth.uid, auth.profile?.gems]);
}

// v3: one unlock flow for every disc — server catalog discs are bought with gems (buy_disc RPC),
// discs the server does not list yet are unlocked locally with coins. Returns true when equipped.
export function useUnlockDisc(toast: (m: string, k?: string) => void) {
  const { p, set } = useStore();
  const buyServer = useBuyDisc(toast, id => set(q => ({ team: id, ownedTeams: q.ownedTeams.includes(id) ? q.ownedTeams : [...q.ownedTeams, id] })));
  return useCallback(async (id: string, name: string) => {
    if (onServer(id)) return buyServer(id, name);
    const price = localCoinPrice(id);
    if (p.coins < price) { toast(tr(`${num(price - p.coins)} سکه‌ی دیگر لازم داری`, `You need ${num(price - p.coins)} more coins`), 'err'); return false; }
    set(q => ({ coins: q.coins - price, team: id, ownedTeams: q.ownedTeams.includes(id) ? q.ownedTeams : [...q.ownedTeams, id] }));
    toast(tr(`${name} باز شد!`, `${name} unlocked!`), 'ok'); return true;
  }, [p.coins, buyServer]);
}
