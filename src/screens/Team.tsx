import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BALL_IMG, FIELD_THUMB, TEAM_IMG, UI, UI2 } from '../game/assets';
import { BALL_NAMES, CATS, FIELDS, FORMS, TEAMS, TRAILS, Team as TeamT, ballPrice, fieldPrice, slots, teamPrice } from '../game/data';
import { RARITY, rarity, teamById, teamKey } from '../game/util';
import { useStore } from '../store';
import { Btn, Img, Panel, Press, Pulse, Segment, T, rowDir, startAlign, textStart } from '../ui/kit';
import { Icon } from '../ui/vec/Icon';
import { HoloPad } from '../ui/vec/Art';
import { tr, isRTL } from '../i18n';
import { C, F, G, N, fa } from '../ui/theme';
import { buzz, sfx } from '../sound';
import { useDiscs, discStats, localCoinPrice, onServer } from '../net/discs';
import { useAuth } from '../net/auth';
import { StatBars } from '../online/ui';

type Toast = (m: string, k?: string) => void;
type Sub = 'disc' | 'ball' | 'field' | 'form';

function TeamScreen({ top, bottom, toast }: { top: number; bottom: number; toast: Toast }) {
  const [sub, setSub] = useState<Sub>('disc');
  return (
    <View style={{ flex: 1, paddingTop: top }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <View style={{ flexDirection: rowDir(), alignItems: 'baseline', marginBottom: 8 }}>
          <T s={tr('انتخاب تجهیزات', 'SELECT LOADOUT')} style={{ fontFamily: F.title, fontSize: 18 }} />
          <T s={tr('  LOADOUT', '  تجهیزات')} raw style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 2, color: N.cyan }} />
        </View>
        <Segment value={sub} onChange={setSub} items={[['disc', tr('دیسک', 'Disc')], ['ball', tr('توپ', 'Ball')], ['field', tr('زمین', 'Pitch')], ['form', tr('ترکیب', 'Formation')]]} />
      </View>
      <View style={{ flex: 1 }}>
        {sub === 'disc' ? <Discs bottom={bottom} toast={toast} /> : sub === 'ball' ? <Balls bottom={bottom} toast={toast} /> : sub === 'field' ? <Fields bottom={bottom} toast={toast} /> : <Formation bottom={bottom} />}
      </View>
    </View>
  );
}
export default memo(TeamScreen);

// ---------- discs ----------
const CAT_INFO: Record<string, [string, string, string]> = { dlx: ['دلوکس', 'DELUXE', '#ff7ae0'], club: ['باشگاه‌ها', 'CLUBS', '#27e6ff'], car: ['خودروها', 'CARS', '#ffd257'] };
function Discs({ bottom, toast }: { bottom: number; toast: Toast }) {
  const { p, set } = useStore(); const { width: W } = useWindowDimensions();
  const [cat, setCat] = useState<string>(teamById(p.team).cat);
  const [focus, setFocus] = useState(p.team);
  const list = useMemo(() => TEAMS.filter(t => t.cat === cat), [cat]);
  const cols = W >= 600 ? 6 : 4, cell = (W - 32 - (cols - 1) * 8) / cols;
  const dz = useDiscs(); const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const ownedId = useCallback((id: string) => dz.has(id) || p.ownedTeams.includes(id), [dz.has, p.ownedTeams]);
  const ft = teamById(focus), owned = ownedId(ft.id), server = onServer(ft.id), ds = discStats(ft.id), rk = rarity(ft), rr = RARITY[rk];
  const gemPrice = dz.catalog[ft.id]?.price_gems ?? 0, coinPrice = localCoinPrice(ft.id);
  const act = async () => {
    if (busy) return;
    if (owned) {
      set({ team: ft.id }); buzz('success'); toast(tr(`${ft.name} انتخاب شد`, `${ft.name} selected`), 'ok');
      if (auth.uid && server) dz.equip(ft.id).then(r => { if (!r.ok) toast(r.error!, 'err'); });
      return;
    }
    if (!server) {
      // disc not in the server catalog yet → unlock locally with coins
      if (p.coins < coinPrice) { toast(tr(`${fa(coinPrice - p.coins)} سکه‌ی دیگر لازم داری`, `You need ${fa(coinPrice - p.coins)} more coins`), 'err'); buzz('medium'); return; }
      set(q => ({ coins: q.coins - coinPrice, team: ft.id, ownedTeams: q.ownedTeams.includes(ft.id) ? q.ownedTeams : [...q.ownedTeams, ft.id] }));
      sfx('win'); buzz('success'); toast(tr(`${ft.name} باز شد!`, `${ft.name} unlocked!`), 'ok'); return;
    }
    setBusy(true);
    try {
      if (!auth.uid) { const id = await auth.ensure(); if (!id) { toast(tr('برای خرید باید آنلاین باشی', 'You need to be online to buy'), 'err'); return; } }
      const g = auth.profile?.gems ?? 0;
      if (auth.profile && g < gemPrice) { toast(tr(`${fa(gemPrice - g)} الماس دیگر لازم داری · چالش‌های روزانه و تورنمنت‌ها الماس می‌دهند`, `You need ${fa(gemPrice - g)} more gems · daily challenges and tournaments give gems`), 'err'); buzz('medium'); return; }
      const r = await dz.buy(ft.id);
      if (!r.ok) { toast(r.error!, 'err'); return; }
      await dz.equip(ft.id); set(q => ({ team: ft.id, ownedTeams: q.ownedTeams.includes(ft.id) ? q.ownedTeams : [...q.ownedTeams, ft.id] }));
      sfx('win'); buzz('success'); toast(tr(`${ft.name} باز شد!`, `${ft.name} unlocked!`), 'ok');
    } finally { setBusy(false); }
  };
  const priceLabel = server ? `💎 ${fa(gemPrice)}` : `◉ ${fa(coinPrice)}`;
  const header = (
    <View>
      <View style={{ flexDirection: rowDir(), paddingHorizontal: 12, marginTop: 4 }}>
        {(['dlx', 'club', 'car'] as const).map(k => (
          <Press key={k} onPress={() => setCat(k)} style={{ flex: 1, marginHorizontal: 3 }}>
            <View style={[s.tab, cat === k && { borderColor: CAT_INFO[k][2], backgroundColor: CAT_INFO[k][2] + '22' }]}>
              {k === 'dlx' ? <Icon name="crown" size={16} /> : <Icon name={k === 'car' ? 'bolt' : 'shield'} size={16} />}
              <T s={tr(CAT_INFO[k][0], CAT_INFO[k][1])} n={1} style={{ fontFamily: F.bold, fontSize: 12, marginHorizontal: 4, color: cat === k ? '#fff' : C.dim }} />
            </View>
          </Press>
        ))}
      </View>
      <View style={{ flexDirection: rowDir(), alignItems: 'center', paddingHorizontal: 12, marginTop: 6 }}>
        <View style={{ flex: 1.1 }}><DiscHero t={ft} color={rr.c} /></View>
        <Panel style={{ flex: 1, padding: 10 }} accent={rr.c}>
          <TierBadge rk={rk} />
          <T s={ft.name} n={2} raw style={{ fontFamily: F.title, fontSize: 15, marginTop: 6, textAlign: textStart() }} />
          <View style={{ marginTop: 8 }}><StatBars power={ds.power} accuracy={ds.accuracy} /></View>
          <T s={ft.tier === 'dlx' ? tr('دیسک دلوکس: بیشترین قدرت و دقت بازی', 'Deluxe disc: top power & accuracy in the game') : tr('قدرت = سرعت ضربه · دقت = انحراف کمتر', 'Power = shot speed · Accuracy = less deviation')} n={3} style={{ fontSize: 10, color: C.dim, marginTop: 6, textAlign: textStart() }} />
        </Panel>
      </View>
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        {p.team === ft.id ? <Btn label={tr('انتخاب‌شده ✓', 'EQUIPPED ✓')} small colors={G.dark} disabled />
          : owned ? <Btn label={tr('انتخاب این دیسک', 'EQUIP THIS DISC')} small onPress={act} />
            : <Btn label={busy ? '…' : `${tr('خرید', 'BUY')} · ${priceLabel}`} sub={!server ? tr('باز کردن با سکه', 'unlock with coins') : auth.profile ? tr(`موجودی: ${fa(auth.profile.gems)} الماس`, `balance: ${fa(auth.profile.gems)} gems`) : undefined} small colors={ft.tier === 'dlx' ? ['#ff7ae0', '#a43bff', '#ffd257'] : G.violet} onPress={act} disabled={busy} />}
      </View>
      <View style={{ flexDirection: rowDir(), alignItems: 'center', paddingHorizontal: 16, marginTop: 14, marginBottom: 8 }}>
        <T s={tr(`${CAT_INFO[cat][0]} · ${fa(list.length)} دیسک`, `${CAT_INFO[cat][1]} · ${list.length} discs`)} style={{ fontFamily: F.bold, fontSize: 12, color: CAT_INFO[cat][2] }} />
        <View style={{ flex: 1, height: 1, backgroundColor: CAT_INFO[cat][2] + '44', marginHorizontal: 8 }} />
      </View>
    </View>
  );
  const render = useCallback(({ item: t, index }: { item: TeamT; index: number }) => (
    <DiscCell t={t} cell={cell} last={index % cols === cols - 1} sel={t.id === focus} own={ownedId(t.id)} price={onServer(t.id) ? `💎${dz.catalog[t.id]?.price_gems ?? 0}` : `◉${localCoinPrice(t.id)}`} eq={t.id === p.team} onPress={() => setFocus(t.id)} />
  ), [cell, cols, focus, ownedId, dz.catalog, p.team]);
  return (
    <FlatList data={list} key={'d' + cat + cols} numColumns={cols} keyExtractor={t => t.id} renderItem={render} ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: bottom + 10 }} columnWrapperStyle={{ paddingHorizontal: 16, flexDirection: rowDir() }} showsVerticalScrollIndicator={false}
      initialNumToRender={16} maxToRenderPerBatch={12} windowSize={7} removeClippedSubviews />
  );
}

function TierBadge({ rk }: { rk: number }) {
  const r = RARITY[rk];
  return (
    <View style={[s.rar, { borderColor: r.c, backgroundColor: r.c + '22', alignSelf: startAlign(), flexDirection: rowDir() }]}>
      {rk === 4 ? <Icon name="crown" size={13} glow={false} /> : null}
      <T s={tr(r.fa, r.n)} style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 2, color: r.c, marginHorizontal: 3 }} />
    </View>
  );
}

const DiscCell = memo(function DiscCell({ t, cell, last, sel, own, eq, price, onPress }: { t: TeamT; cell: number; last: boolean; sel: boolean; own: boolean; eq: boolean; price: string; onPress: () => void }) {
  const rc = RARITY[rarity(t)].c, dlx = t.tier === 'dlx';
  return (
    <Press onPress={onPress} style={{ width: cell, marginLeft: isRTL() && !last ? 8 : 0, marginRight: !isRTL() && !last ? 8 : 0, marginBottom: 8 }} scaleTo={.92}>
      <View style={[s.cell, { height: cell + 22, borderColor: sel ? rc : dlx ? rc + '66' : 'rgba(110,170,255,.16)' }, sel && { backgroundColor: rc + '22' }]}>
        {dlx ? <LinearGradient colors={['rgba(255,122,224,.18)', 'rgba(255,210,87,.06)', 'transparent']} style={StyleSheet.absoluteFill} /> : null}
        <Img src={TEAM_IMG[teamKey(t)]} style={{ width: cell - 12, height: cell - 12, opacity: own ? 1 : .55 }} />
        {eq ? <T s={tr('● فعال', '● ACTIVE')} style={{ fontSize: 9, color: C.green, marginTop: 1 }} /> : own ? <T s={t.name} n={1} raw style={{ fontSize: 8, color: C.dim, marginTop: 1, maxWidth: cell - 6 }} /> : (
          <T s={price} n={1} style={{ fontFamily: F.head, fontSize: 8, color: price.startsWith('◉') ? C.gold : '#9fd8ff', marginTop: 1 }} />
        )}
        {!own ? <View style={s.lock}><Icon name="lock" size={12} glow={false} /></View> : null}
        {dlx ? <View style={s.crown}><Icon name="crown" size={13} glow={false} /></View> : null}
      </View>
    </Press>
  );
});

function DiscHero({ t, color }: { t: TeamT; color: string }) {
  const spin = useSharedValue(0), pop = useSharedValue(1);
  useEffect(() => { spin.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false); }, []);
  useEffect(() => { pop.value = withSequence(withTiming(.8, { duration: 70 }), withSpring(1, { damping: 8, stiffness: 220 })); }, [t.id]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const ring2 = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 720}deg` }] }));
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const S = 150;
  return (
    <View style={{ height: S + 40, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', bottom: 0 }}><HoloPad width={S * 1.25} color={color} /></View>
      <Animated.View style={[{ position: 'absolute', width: S + 16, height: S + 16, borderRadius: (S + 16) / 2, borderWidth: 2, borderColor: color + 'aa', borderStyle: 'dashed' }, ring]} />
      <Animated.View style={[{ position: 'absolute', width: S - 6, height: S - 6, borderRadius: (S - 6) / 2, borderWidth: 1, borderColor: N.purple + '99' }, ring2]} />
      <Animated.View style={disc}><Img src={TEAM_IMG[teamKey(t)]} style={{ width: S - 14, height: S - 14 }} /></Animated.View>
    </View>
  );
}

// ---------- balls ----------
function Balls({ bottom, toast }: { bottom: number; toast: Toast }) {
  const { p, set } = useStore(); const { width: W } = useWindowDimensions();
  const [fb, setFb] = useState(p.ball);
  const ids = useMemo(() => Array.from({ length: 36 }, (_, i) => i), []);
  const cell = (W - 32 - 3 * 8) / 4;
  const owned = p.ownedBalls.includes(fb), price = ballPrice(fb), eq = p.ball === fb, tr = TRAILS[fb % TRAILS.length].c;
  const act = () => {
    if (owned) { set({ ball: fb }); buzz('success'); toast('توپ انتخاب شد', 'ok'); return; }
    if (p.coins < price) { toast('سکه کافی نداری', 'err'); return; }
    set(q => ({ coins: q.coins - price, ownedBalls: [...q.ownedBalls, fb], ball: fb })); sfx('goal'); buzz('success'); toast('توپ جدید باز شد!', 'ok');
  };
  const header = (
    <View>
      <BallHero idx={fb} />
      <T s={`${BALL_NAMES[fb]}`.toUpperCase()} style={{ fontFamily: F.title, fontSize: 20, textAlign: 'center' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>{tr.map((c, i) => <View key={i} style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: c, marginHorizontal: 3, shadowColor: c, shadowOpacity: 1, shadowRadius: 6 }} />)}</View>
      <T s="رنگ دنباله‌ی توپ" style={{ fontSize: 10, color: C.dim, textAlign: 'center', marginTop: 4 }} />
      <View style={{ paddingHorizontal: 50, marginTop: 12, marginBottom: 14 }}>
        {eq ? <Btn label="انتخاب‌شده ✓" small colors={G.dark} disabled /> : owned ? <Btn label="انتخاب" small onPress={act} colors={G.green} /> : <Btn label={`خرید · ${price}`} small icon={UI2.c_coin} colors={G.gold} onPress={act} />}
      </View>
    </View>
  );
  return (
    <FlatList data={ids} numColumns={4} keyExtractor={i => 'b' + i} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: bottom + 10 }} columnWrapperStyle={{ paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false} initialNumToRender={16} removeClippedSubviews
      renderItem={({ item: i, index }) => {
        const own = p.ownedBalls.includes(i), sel = i === fb, e = p.ball === i;
        return (
          <Press onPress={() => setFb(i)} style={{ width: cell, marginRight: index % 4 === 3 ? 0 : 8, marginBottom: 8 }} scaleTo={.92}>
            <View style={[s.cell, { height: cell + 18, borderColor: sel ? C.green : 'rgba(110,170,255,.16)' }, sel && { backgroundColor: 'rgba(61,255,168,.12)' }]}>
              <Img src={BALL_IMG['b' + i]} style={{ width: cell - 22, height: cell - 22, borderRadius: (cell - 22) / 2, opacity: own ? 1 : .5 }} />
              <T s={e ? '● فعال' : own ? BALL_NAMES[i] : `${ballPrice(i)} ◉`} n={1} style={{ fontSize: 9, color: e ? C.green : own ? C.dim : C.gold, marginTop: 3, fontFamily: own && !e ? F.head : undefined }} />
            </View>
          </Press>
        );
      }} />
  );
}

function BallHero({ idx }: { idx: number }) {
  const spin = useSharedValue(0), bob = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    bob.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 14 }, { rotate: `${spin.value * 360}deg` }] }));
  const sh = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - bob.value * .25 }], opacity: .55 - bob.value * .2 }));
  return (
    <View style={{ height: 220, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', bottom: 6 }}><HoloPad width={230} /></View>
      <Animated.View style={[{ position: 'absolute', bottom: 40, width: 110, height: 18, borderRadius: 55, backgroundColor: '#000' }, sh]} />
      <Pulse size={130} color="rgba(61,255,216,.35)" />
      <Animated.View style={a}><Img src={BALL_IMG['b' + idx]} style={{ width: 132, height: 132, borderRadius: 66 }} /></Animated.View>
    </View>
  );
}

// ---------- fields ----------
function Fields({ bottom, toast }: { bottom: number; toast: Toast }) {
  const { p, set } = useStore(); const { width: W } = useWindowDimensions();
  const [ff, setFf] = useState(p.field);
  const ids = useMemo(() => FIELDS.map((_, i) => i), []);
  const cell = (W - 32 - 2 * 10) / 3;
  const owned = p.ownedFields.includes(ff), price = fieldPrice(ff), eq = p.field === ff;
  const act = () => {
    if (owned) { set({ field: ff }); buzz('success'); toast('زمین انتخاب شد', 'ok'); return; }
    if (p.coins < price) { toast('سکه کافی نداری', 'err'); return; }
    set(q => ({ coins: q.coins - price, ownedFields: [...q.ownedFields, ff], field: ff })); sfx('goal'); buzz('success'); toast('زمین جدید باز شد!', 'ok');
  };
  const header = (
    <View style={{ alignItems: 'center' }}>
      <View style={s.arena}>
        <Img src={FIELD_THUMB[FIELDS[ff].id]} style={{ width: 160, height: 214, borderRadius: 16 }} fit="cover" />
        <LinearGradient colors={['rgba(255,255,255,.2)', 'transparent', 'rgba(0,0,0,.3)']} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
      </View>
      <T s={FIELDS[ff].name.toUpperCase()} style={{ fontFamily: F.title, fontSize: 20, marginTop: 10 }} />
      <View style={{ alignSelf: 'stretch', paddingHorizontal: 50, marginTop: 12, marginBottom: 14 }}>
        {eq ? <Btn label="انتخاب‌شده ✓" small colors={G.dark} disabled /> : owned ? <Btn label="انتخاب" small onPress={act} colors={G.green} /> : <Btn label={`خرید · ${price}`} small icon={UI2.c_coin} colors={G.gold} onPress={act} />}
      </View>
    </View>
  );
  return (
    <FlatList data={ids} numColumns={3} keyExtractor={i => 'f' + i} ListHeaderComponent={header} contentContainerStyle={{ paddingBottom: bottom + 10 }} columnWrapperStyle={{ paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false} initialNumToRender={9} removeClippedSubviews
      renderItem={({ item: i, index }) => {
        const own = p.ownedFields.includes(i), sel = i === ff, e = p.field === i;
        return (
          <Press onPress={() => setFf(i)} style={{ width: cell, marginRight: index % 3 === 2 ? 0 : 10, marginBottom: 10 }} scaleTo={.94}>
            <View style={[s.cell, { paddingVertical: 8, borderColor: sel ? C.cyan : 'rgba(110,170,255,.16)' }, sel && { backgroundColor: 'rgba(79,227,255,.12)' }]}>
              <Img src={FIELD_THUMB[FIELDS[i].id]} style={{ width: cell - 16, height: (cell - 16) * 1.33, borderRadius: 10, opacity: own ? 1 : .5 }} fit="cover" />
              <T s={e ? '● فعال' : own ? FIELDS[i].name : `${fieldPrice(i)} ◉`} n={1} style={{ fontSize: 10, color: e ? C.green : own ? C.dim : C.gold, marginTop: 4, fontFamily: own && !e ? F.bold : undefined }} />
            </View>
          </Press>
        );
      }} />
  );
}

// ---------- formation ----------
function Formation({ bottom }: { bottom: number }) {
  const { p, set } = useStore(); const { width: W } = useWindowDimensions();
  const me = teamById(p.team);
  const fw = Math.min(W - 64, 300), fh = fw * 1.35;
  const pts = slots(p.form);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + 10, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={[s.pitch, { width: fw, height: fh }]}>
        <Img src={FIELD_THUMB[FIELDS[p.field].id]} style={StyleSheet.absoluteFill} fit="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,6,20,.35)' }]} />
        <View style={[s.mid, { top: fh / 2 }]} />
        <View style={[s.circle, { left: fw / 2 - 30, top: fh / 2 - 30 }]} />
        {pts.map(([nx, ny], i) => <Slot key={p.form + '-' + i} x={18 + nx * (fw - 36)} y={fh - ny * fh * 1.9} img={TEAM_IMG[teamKey(me)]} delay={i * 50} />)}
      </View>
      <T s={`${FORMS[p.form][0]} · ${FORMS[p.form][1]}`} style={{ fontFamily: F.title, fontSize: 18, marginTop: 12 }} />
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 12, marginTop: 10 }}>
        {FORMS.map((f, i) => (
          <Press key={f[0]} onPress={() => set({ form: i })} style={[s.form, p.form === i && { borderColor: C.cyan, backgroundColor: 'rgba(79,227,255,.15)' }]}>
            <T s={f[0]} style={{ fontFamily: F.head, fontSize: 14, color: p.form === i ? '#fff' : C.dim }} />
            <T s={f[1]} style={{ fontFamily: F.body, fontSize: 10, color: C.dim2 }} />
          </Press>
        ))}
      </View>
    </ScrollView>
  );
}

function Slot({ x, y, img, delay }: { x: number; y: number; img: any; delay: number }) {
  const sc = useSharedValue(0);
  useEffect(() => { const t = setTimeout(() => { sc.value = withSpring(1, { damping: 10, stiffness: 200 }); }, delay); return () => clearTimeout(t); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - 20, top: y - 20, width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.cyan, backgroundColor: '#050816', alignItems: 'center', justifyContent: 'center', shadowColor: C.cyan, shadowOpacity: .9, shadowRadius: 8 }, a]}>
      <Img src={img} style={{ width: 34, height: 34, borderRadius: 17 }} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  disc: { width: 148, height: 148, borderRadius: 74, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050816', shadowOpacity: .9, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  rar: { paddingHorizontal: 8, height: 22, borderRadius: 4, borderWidth: 1, alignItems: 'center' },
  tab: { height: 38, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(120,110,255,.3)', backgroundColor: 'rgba(8,5,28,.85)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  crown: { position: 'absolute', top: 3, left: 4 },
  cell: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,12,34,.78)' },
  lock: { position: 'absolute', top: 4, right: 4 },
  arena: { marginTop: 8, borderWidth: 2, borderColor: C.cyan, borderRadius: 18, padding: 3, shadowColor: C.cyan, shadowOpacity: .7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 10, backgroundColor: '#050816' },
  pitch: { marginTop: 8, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(79,227,255,.55)' },
  mid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,.35)' },
  circle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,.35)' },
  form: { width: 92, alignItems: 'center', paddingVertical: 10, margin: 4, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(8,12,34,.8)' },
});
void fa;
