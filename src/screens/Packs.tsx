// Disc packs (bundles of 2–6 discs) sold for 130–300 gems by the server (buy_pack RPC).
import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TEAM_IMG, UI2 } from '../game/assets';
import { teamById, teamKey } from '../game/util';
import { Img, Press, T, Title } from '../ui/kit';
import { C, F, fa } from '../ui/theme';
import { buzz, sfx } from '../sound';
import { useAuth } from '../net/auth';
import { useDiscs } from '../net/discs';
import { errFa, rpc, supabase } from '../net/supabase';

type Pack = { id: string; name_fa: string; price_gems: number; discs: string[]; sort: number };

function Packs({ toast }: { toast: (m: string, k?: string) => void }) {
  const auth = useAuth(); const dz = useDiscs();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { supabase.from('disc_packs').select('*').order('sort').then(({ data }) => setPacks((data || []) as Pack[]), () => {}); }, []);
  if (!packs.length) return null;
  const buy = async (pk: Pack) => {
    if (busy) return;
    if (!auth.uid) { const u = await auth.ensure().catch(() => null); if (!u) { toast('برای خرید باید آنلاین باشی', 'err'); return; } }
    if ((auth.profile?.gems ?? 0) < pk.price_gems) { toast(`${fa(pk.price_gems - (auth.profile?.gems ?? 0))} الماس کم داری`, 'err'); return; }
    setBusy(pk.id);
    try { await rpc<number>('buy_pack', { p_pack: pk.id }); sfx('win'); buzz('success'); toast(`${pk.name_fa} باز شد!`, 'ok'); auth.refreshProfile(); }
    catch (e) { toast(errFa(e), 'err'); } finally { setBusy(null); }
  };
  return (
    <View>
      <Title s="بسته‌های دیسک" en="DISC PACKS · 130–300 💎" accent={C.gold} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, flexDirection: 'row-reverse' }}>
        {packs.map(pk => {
          const owned = pk.discs.filter(d => dz.owned.has(d)).length, all = owned === pk.discs.length;
          return (
            <Press key={pk.id} onPress={() => buy(pk)} disabled={all || !!busy} style={[st.card, all && { opacity: .5 }]}>
              <LinearGradient colors={['rgba(255,210,87,.28)', 'rgba(10,14,40,.95)']} style={StyleSheet.absoluteFill} />
              <View style={st.fan}>
                {pk.discs.slice(0, 4).map((d, i) => (
                  <Img key={d} src={TEAM_IMG[teamKey(teamById(d))]} style={{ width: 46, height: 46, position: 'absolute', left: 8 + i * 22, top: (i % 2) * 8, transform: [{ rotate: `${(i - 1.5) * 9}deg` }] }} />
                ))}
              </View>
              <T s={pk.name_fa} n={1} style={{ fontFamily: F.bold, fontSize: 12, marginTop: 6 }} />
              <T s={all ? 'همه را داری' : owned ? `${fa(owned)} از ${fa(pk.discs.length)} را داری` : `${fa(pk.discs.length)} دیسک`} style={{ fontSize: 10, color: C.dim }} />
              <View style={st.price}><Img src={UI2.x_gem} style={{ width: 16, height: 16 }} /><T s={busy === pk.id ? '…' : fa(pk.price_gems)} style={{ fontFamily: F.title, fontSize: 13, marginLeft: 4, color: '#9fd8ff' }} /></View>
            </Press>
          );
        })}
      </ScrollView>
    </View>
  );
}
export default memo(Packs);

const st = StyleSheet.create({
  card: { width: 150, height: 170, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,210,87,.5)', marginLeft: 10, padding: 10, alignItems: 'center', overflow: 'hidden' },
  fan: { width: 126, height: 64 },
  price: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,.35)' },
});
