import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { TEAM_IMG, UI2 } from '../game/assets';
import { TEAMS } from '../game/data';
import { CHEST_EVERY, ChestPrize, Item, allItems, dailyDeals, grant } from '../game/meta';
import { rarity, teamKey } from '../game/util';
import { useStore } from '../store';
import { Btn, Enter, Float, Img, Panel, Press, Pulse, Segment, T, Title, rowDir, startAlign, textStart } from '../ui/kit';
import { C, F, G, N, fa } from '../ui/theme';
import { discStats, localCoinPrice, onServer, useDiscs, useUnlockDisc } from '../net/discs';
import { Icon } from '../ui/vec/Icon';
import { Chamfer, Chest } from '../ui/vec/Art';
import { tr } from '../i18n';
import Packs from './Packs';
import { useAuth } from '../net/auth';
import { StatBars } from '../online/ui';
import { buzz, sfx } from '../sound';

type Toast = (m: string, k?: string) => void;
const RC = ['#8ea3d6', '#4fe3ff', '#b46bff', '#ffd257', '#ff7ae0'];

function Shop({ top, bottom, toast, onChest }: { top: number; bottom: number; toast: Toast; onChest: (premium: boolean) => void }) {
  const { p, set } = useStore(); const { width: W } = useWindowDimensions();
  const [kind, setKind] = useState<'team' | 'ball' | 'field'>('team');
  const items = useMemo(() => allItems(p), [p.ownedTeams, p.ownedBalls, p.ownedFields]);
  const deals = useMemo(() => dailyDeals(p), [p.ownedTeams, p.ownedBalls, p.ownedFields]);
  const deluxe = useMemo(() => TEAMS.filter(t => t.tier === 'dlx'), []);
  const now = Date.now(), freeIn = Math.max(0, p.lastChest + CHEST_EVERY - now);
  const buy = (it: Item) => {
    if (p.coins < it.price) { toast(tr('سکه کافی نداری', 'Not enough coins'), 'err'); buzz('medium'); return; }
    set(q => ({ coins: q.coins - it.price, ...grant(it)(q) })); sfx('goal'); buzz('success'); toast(tr(`${it.name} باز شد!`, `${it.name} unlocked!`), 'ok');
  };
  const dz = useDiscs(); const auth = useAuth();
  const unlock = useUnlockDisc(toast);
  const own = (id: string) => dz.has(id) || p.ownedTeams.includes(id);
  const price = (id: string): [number, boolean] => (onServer(id) ? [dz.catalog[id]?.price_gems ?? 0, true] : [localCoinPrice(id), false]);
  const stdDiscs = useMemo(() => TEAMS.filter(t => t.tier === 'std' && !own(t.id) && price(t.id)[0] > 0), [dz.catalog, dz.owned, p.ownedTeams]);
  const cols = W >= 600 ? 5 : 3, cell = (W - 32 - (cols - 1) * 8) / cols;
  const list = items.filter(i => i.kind === kind);
  const featured = deluxe[Math.floor(now / 86400000) % deluxe.length];
  // section tiles jump inside the scroll view
  const sv = useRef<any>(null); const ys = useRef<Record<string, number>>({});
  const jump = (k: string) => sv.current?.scrollTo({ y: Math.max(0, (ys.current[k] ?? 0) - top + 40), animated: true });
  const mark = (k: string) => (e: any) => { ys.current[k] = e.nativeEvent.layout.y; };
  const tiles: [string, string, string, string, string][] = [['dlx', 'دلوکس', 'DELUXE', 'crown', '#ff7ae0'], ['chest', 'صندوقچه', 'CHESTS', 'chest', '#ffd257'], ['deal', 'پیشنهاد', 'DEALS', 'fire', '#3dffb0'], ['cat', 'فروشگاه', 'CATALOG', 'cart', '#27e6ff']];
  return (
    <ScrollView ref={sv} contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + 10 }} showsVerticalScrollIndicator={false}>
      <Enter i={0} style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: rowDir(), alignItems: 'baseline' }}>
          <T s={tr('فروشگاه', 'SHOP')} style={{ fontFamily: F.title, fontSize: 22 }} />
          <T s={tr('  SHOP', '  فروشگاه')} raw style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 2, color: N.cyan }} />
        </View>
      </Enter>
      <View style={{ flexDirection: rowDir(), paddingHorizontal: 12, marginTop: 10 }}>
        {tiles.map(([k, f, e, ic, c], i) => (
          <Enter key={k} i={i} style={{ flex: 1, paddingHorizontal: 4 }}>
            <Press onPress={() => jump(k)} scaleTo={.93}>
              <Chamfer k={10} color={c} color2={N.purple} style={{ height: 84 }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={ic} size={34} />
                  <T s={tr(f, e)} n={1} style={{ fontFamily: F.bold, fontSize: 11, marginTop: 4 }} />
                </View>
              </Chamfer>
            </Press>
          </Enter>
        ))}
      </View>

      {/* Deluxe tier */}
      <View onLayout={mark('dlx')} />
      <Enter i={1} style={{ paddingHorizontal: 16, marginTop: 14 }}>
        <View style={[s.banner, { flexDirection: rowDir() }]}>
          <LinearGradient colors={['#3a0a3a', '#1a0d4a', '#05020f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, padding: 14, alignItems: startAlign() }}>
            <View style={[s.tag, { flexDirection: rowDir() }]}><Icon name="crown" size={13} glow={false} /><T s="DELUXE" raw style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 2, color: '#2a0020', marginHorizontal: 3 }} /></View>
            <T s={tr('دیسک‌های دلوکس', 'Deluxe discs')} style={{ fontFamily: F.title, fontSize: 19, marginTop: 6 }} />
            <T s={tr('قدرت و دقت ۹ تا ۱۰ · بالاتر از همه', 'Power & accuracy 9–10 · above every disc')} n={2} style={{ fontSize: 11, color: '#f2d7ff', marginTop: 4, textAlign: textStart() }} />
            <Btn small label={tr('خرید دیسک روز', 'Get disc of the day')} colors={['#ff7ae0', '#a43bff', '#ffd257']} style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={() => !own(featured.id) && unlock(featured.id, featured.name)} disabled={own(featured.id)} />
          </View>
          <Float amp={6}><Img src={TEAM_IMG[teamKey(featured)]} style={{ width: 120, height: 130, margin: 8 }} /></Float>
        </View>
      </Enter>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10, flexDirection: rowDir() }}>
        {deluxe.map((t, i) => {
          const o = own(t.id), [pr, gem] = price(t.id), ds = discStats(t.id);
          return (
            <Enter key={t.id} i={Math.min(i, 8)}>
              <Press onPress={() => !o && unlock(t.id, t.name)} style={[s.leg, o && { opacity: .65 }]}>
                <LinearGradient colors={['rgba(255,122,224,.28)', 'rgba(10,6,34,.95)']} style={StyleSheet.absoluteFill} />
                <Img src={TEAM_IMG[teamKey(t)]} style={{ width: 92, height: 98 }} />
                <T s={t.name} n={1} raw style={{ fontFamily: F.bold, fontSize: 11, marginTop: 2, maxWidth: 108 }} />
                <T s={`⚡${ds.power} · ◎${ds.accuracy}`} raw style={{ fontFamily: F.head, fontSize: 9, color: '#ffd0f4', marginTop: 1 }} />
                {o ? <T s={tr('✓ داری', '✓ Owned')} style={{ fontSize: 11, color: C.green, marginTop: 3 }} /> : <PriceTag v={pr} gem={gem} />}
              </Press>
            </Enter>
          );
        })}
      </ScrollView>

      <Packs toast={toast} />

      {/* chests */}
      <View onLayout={mark('chest')} />
      <Title s={tr('صندوقچه‌ها', 'Chests')} en="SUPPLY CHESTS" accent={C.violet} />
      <View style={{ flexDirection: rowDir(), paddingHorizontal: 12 }}>
        <Enter i={1} style={{ flex: 1, padding: 4 }}>
          <Panel style={{ alignItems: 'center', padding: 12 }} accent={C.cyan} glow={!freeIn}>
            <Shake on={!freeIn}><Chest size={104} rarity={1} /></Shake>
            <T s={tr('صندوقچه‌ی رایگان', 'Free chest')} n={1} style={{ fontFamily: F.bold, fontSize: 13, marginTop: 4 }} />
            <T s={tr('هر ۴ ساعت', 'Every 4 hours')} style={{ fontSize: 10, color: C.dim }} />
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <Btn small label={freeIn ? fmt(freeIn) : tr('باز کن', 'OPEN')} disabled={!!freeIn} colors={G.primary} onPress={() => onChest(false)} />
            </View>
          </Panel>
        </Enter>
        <Enter i={2} style={{ flex: 1, padding: 4 }}>
          <Panel style={{ alignItems: 'center', padding: 12 }} accent={C.gold} glow>
            <Shake on><Chest size={104} rarity={3} /></Shake>
            <T s={tr('صندوقچه‌ی سلطنتی', 'Royal chest')} n={1} style={{ fontFamily: F.bold, fontSize: 13, marginTop: 4 }} />
            <T s={tr('آیتم کمیاب تضمینی‌تر', 'Better rare odds')} style={{ fontSize: 10, color: C.dim }} />
            <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <Btn small label={tr('۶۰۰ سکه', '600 coins')} icon={UI2.c_coin} colors={G.violet} onPress={() => { if (p.coins < 600) { toast(tr('۶۰۰ سکه لازمه', 'You need 600 coins'), 'err'); return; } onChest(true); }} />
            </View>
          </Panel>
        </Enter>
      </View>

      {/* deals */}
      <View onLayout={mark('deal')} />
      {deals.length ? <Title s={tr('پیشنهاد امروز', "Today's deals")} en="DAILY DEALS · -30%" accent={C.green} /> : null}
      <View style={{ flexDirection: rowDir(), flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' }}>
        {deals.map((it, i) => (
          <Enter key={it.kind + it.id} i={i} style={{ width: (W - 32 - 8) / 2, marginBottom: 8 }}>
            <Press onPress={() => buy(it)}>
              <Panel style={{ flexDirection: rowDir(), alignItems: 'center', padding: 10 }} accent={RC[it.rar]}>
                <Img src={it.img} style={it.kind === 'field' ? { width: 40, height: 54, borderRadius: 6 } : { width: 54, height: 54, borderRadius: 27 }} fit={it.kind === 'field' ? 'cover' : 'contain'} />
                <View style={{ flex: 1, marginHorizontal: 8, alignItems: startAlign() }}>
                  <T s={it.name} n={1} raw style={{ fontFamily: F.bold, fontSize: 12 }} />
                  <View style={s.off}><T s={tr('-۳۰٪', '-30%')} style={{ fontSize: 10, color: '#03140c', fontFamily: F.bold }} /></View>
                  <PriceTag v={it.price} />
                </View>
              </Panel>
            </Press>
          </Enter>
        ))}
      </View>

      {/* catalogue */}
      <View onLayout={mark('cat')} />
      <Title s={tr('همه‌ی تجهیزات', 'Catalogue')} en="CATALOGUE" />
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Segment value={kind} onChange={setKind} items={[['team', tr('دیسک', 'Discs')], ['ball', tr('توپ', 'Balls')], ['field', tr('زمین', 'Pitches')]]} accent={C.gold} />
      </View>
      {kind === 'team' ? (
        <View style={{ flexDirection: rowDir(), flexWrap: 'wrap', paddingHorizontal: 16 }}>
          {!auth.profile ? <T s={tr('دیسک‌های سرور با الماس، دیسک‌های تازه با سکه باز می‌شن؛ با ورود آنلاین ۱۵۰ الماس هدیه می‌گیری.', 'Server discs cost gems, the new ones unlock with coins; sign in (even as a guest) for 150 free gems.')} style={{ fontSize: 11, color: C.dim, textAlign: textStart(), marginBottom: 8, width: '100%' }} /> : null}
          {stdDiscs.slice(0, 60).map((t, i) => {
            const [pr, gem] = price(t.id), ds = discStats(t.id);
            return (
              <Press key={t.id} onPress={() => unlock(t.id, t.name)} style={{ width: cell, marginHorizontal: (i % cols) === cols - 1 ? 0 : 4, marginBottom: 8 }} scaleTo={.93}>
                <View style={[s.card, { borderColor: RC[rarity(t)] + '66', paddingHorizontal: 6 }]}>
                  <Img src={TEAM_IMG[teamKey(t)]} style={{ width: cell * .62, height: cell * .62 }} />
                  <T s={t.name} n={1} raw style={{ fontFamily: F.bold, fontSize: 10, marginTop: 4 }} />
                  <StatBars power={ds.power} accuracy={ds.accuracy} compact />
                  <PriceTag v={pr} gem={gem} />
                </View>
              </Press>
            );
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: rowDir(), flexWrap: 'wrap', paddingHorizontal: 16 }}>
        {list.slice(0, 60).map((it, i) => (
          <Press key={it.kind + it.id} onPress={() => buy(it)} style={{ width: cell, marginHorizontal: (i % cols) === cols - 1 ? 0 : 4, marginBottom: 8 }} scaleTo={.93}>
            <View style={[s.card, { borderColor: RC[it.rar] + '66' }]}>
              <LinearGradient colors={[RC[it.rar] + '30', 'rgba(8,12,34,.2)']} style={StyleSheet.absoluteFill} />
              <Img src={it.img} style={it.kind === 'field' ? { width: cell * .52, height: cell * .7, borderRadius: 6 } : { width: cell * .64, height: cell * .64, borderRadius: cell }} fit={it.kind === 'field' ? 'cover' : 'contain'} />
              <T s={it.name} n={1} raw style={{ fontFamily: F.bold, fontSize: 10, marginTop: 5 }} />
              <PriceTag v={it.price} />
            </View>
          </Press>
        ))}
      </View>
      {!list.length && kind !== 'team' ? <T s={tr('همه‌چیز این بخش رو داری، اسطوره!', 'You own everything here, legend!')} style={{ textAlign: 'center', color: C.dim, marginTop: 10 }} /> : null}
    </ScrollView>
  );
}
export default memo(Shop);

const fmt = (ms: number) => { const m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h ? tr(`${fa(h)}س ${fa(m % 60)}د`, `${h}h ${m % 60}m`) : tr(`${fa(m)} دقیقه`, `${m} min`); };

function PriceTag({ v, gem }: { v: number; gem?: boolean }) {
  return (
    <View style={s.price}><Img src={gem ? UI2.x_gem : UI2.c_coin} style={{ width: 16, height: 16 }} /><T s={v} style={{ fontFamily: F.head, fontSize: 10, color: gem ? '#9fd8ff' : C.gold, marginLeft: 3 }} /></View>
  );
}

function Shake({ on, children }: { on: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (on) r.value = withRepeat(withSequence(withTiming(1, { duration: 80 }), withTiming(-1, { duration: 80 }), withTiming(1, { duration: 80 }), withTiming(0, { duration: 80 }), withDelay(1800, withTiming(0, { duration: 10 }))), -1, false);
    else r.value = 0;
  }, [on]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 6}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

// ---------- chest opening (shown by App in a Modal) ----------
export function ChestOpen({ prize, premium, onDone }: { prize: ChestPrize; premium: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const shake = useSharedValue(0), pop = useSharedValue(0), rays = useSharedValue(0);
  useEffect(() => {
    shake.value = withSequence(withRepeat(withSequence(withTiming(1, { duration: 70 }), withTiming(-1, { duration: 70 })), 6, true), withTiming(0, { duration: 60 }));
    const t = setTimeout(() => { setOpen(true); sfx('goal'); buzz('heavy'); pop.value = withSpring(1, { damping: 9, stiffness: 160 }); }, 1000);
    rays.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    return () => clearTimeout(t);
  }, []);
  const ch = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 8}deg` }, { scale: 1 + Math.abs(shake.value) * .05 }] }));
  const pr = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: .3 + pop.value * .7 }, { translateY: (1 - pop.value) * 40 }] }));
  const ry = useAnimatedStyle(() => ({ transform: [{ rotate: `${rays.value * 360}deg` }] }));
  const it = prize.item;
  return (
    <View style={{ alignItems: 'center', padding: 22 }}>
      <T s={premium ? tr('صندوقچه‌ی سلطنتی', 'Royal chest') : tr('صندوقچه‌ی رایگان', 'Free chest')} style={{ fontFamily: F.title, fontSize: 20 }} />
      <View style={{ height: 220, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderStyle: 'dashed', borderColor: premium ? '#ffd257' : '#27e6ff', opacity: open ? .8 : .3 }, ry]} />
        <Pulse size={140} color={premium ? 'rgba(255,210,87,.4)' : 'rgba(79,227,255,.4)'} />
        {!open ? <Animated.View style={ch}><Chest size={170} rarity={premium ? 3 : 1} /></Animated.View> : (
          <Animated.View style={[{ alignItems: 'center' }, pr]}>
            {it ? <Img src={it.img} style={it.kind === 'field' ? { width: 110, height: 150, borderRadius: 12 } : { width: 150, height: 150, borderRadius: 75 }} fit={it.kind === 'field' ? 'cover' : 'contain'} /> : <View style={{ alignItems: 'center' }}><Chest size={120} rarity={premium ? 3 : 1} open /><Icon name="coins" size={64} /></View>}
          </Animated.View>
        )}
      </View>
      {open ? (
        <Animated.View style={[{ alignItems: 'center', alignSelf: 'stretch' }, pr]}>
          {it ? <T s={it.name} style={{ fontFamily: F.title, fontSize: 18, color: RC[it.rar] }} /> : null}
          <T s={[it ? 'آیتم جدید باز شد!' : '', prize.coins ? `+${fa(prize.coins)} سکه` : '', prize.gems ? `+${fa(prize.gems)} الماس` : ''].filter(Boolean).join(' · ')} style={{ color: C.dim, marginTop: 4, textAlign: 'center' }} />
          <View style={{ alignSelf: 'stretch', marginTop: 16 }}><Btn label="عالیه!" onPress={onDone} colors={G.gold} /></View>
        </Animated.View>
      ) : <T s="در حال باز شدن..." style={{ color: C.dim }} />}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { minHeight: 160, borderRadius: 14, overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,122,224,.6)', shadowColor: '#ff7ae0', shadowOpacity: .45, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  tag: { paddingHorizontal: 8, height: 22, borderRadius: 4, backgroundColor: '#ff9ae6', alignItems: 'center' },
  leg: { width: 120, height: 176, marginHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,122,224,.5)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0d26' },
  price: { flexDirection: 'row', alignItems: 'center', marginTop: 5, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,210,87,.14)', borderWidth: 1, borderColor: 'rgba(255,210,87,.3)' },
  off: { marginTop: 3, paddingHorizontal: 6, height: 16, borderRadius: 8, backgroundColor: C.green, justifyContent: 'center' },
  best: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, height: 16, borderRadius: 8, backgroundColor: C.gold, justifyContent: 'center', zIndex: 2 },
  card: { borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, backgroundColor: 'rgba(8,12,34,.8)' },
});
