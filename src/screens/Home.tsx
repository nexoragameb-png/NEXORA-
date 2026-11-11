import React, { memo, useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BALL_IMG, FIELD_THUMB, TEAM_IMG, UI, UI2 } from '../game/assets';
import { BALL_NAMES, FIELDS, FORMS } from '../game/data';
import { ACHS } from '../game/meta';
import { teamById, teamKey } from '../game/util';
import { LEAGUE_FA, league, useStore } from '../store';
import { Bar, Btn, Enter, Float, Img, Panel, Press, Pulse, T, Title } from '../ui/kit';
import { C, F, G, fa } from '../ui/theme';
import { MODES, Mode } from './Setup';
import type { OnlineEntry } from '../nav';
import OnlineCard from './OnlineCard';

const MEDAL = ['medal_bronze', 'medal_silver', 'medal_gold', 'medal_epic', 'shield_epic', 'shield_crown'];

type Props = { top: number; bottom: number; onOnline: (e?: OnlineEntry) => void; onMode: (m: Mode) => void; onTab: (t: 'team' | 'shop' | 'play' | 'profile') => void; onDaily: () => void; onSettings: () => void; onChest: () => void; dailyReady: boolean; chestReady: boolean };

function Home({ top, bottom, onOnline, onMode, onTab, onDaily, onSettings, onChest, dailyReady, chestReady }: Props) {
  const { width: W } = useWindowDimensions();
  const { p } = useStore(); const lg = league(p.trophies); const me = teamById(p.team);
  const heroW = Math.min(W * .62, 300);
  const pending = ACHS.filter(a => !p.claimedAch.includes(a.id)).slice(0, 3);
  const plates: { img: any; label: string; sub: string; on: () => void; dot?: boolean }[] = [
    { img: UI2.btn_cup, label: 'جام نکسورا', sub: 'NEXORA CUP', on: () => onMode(MODES[1]) },
    { img: UI2.btn_team, label: 'تیم من', sub: 'SQUAD', on: () => onTab('team') },
    { img: UI2.btn_daily, label: 'جایزه روزانه', sub: 'DAILY', on: onDaily, dot: dailyReady },
    { img: UI2.btn_chest, label: 'صندوقچه', sub: 'CHESTS', on: onChest, dot: chestReady },
    { img: UI2.btn_shop, label: 'فروشگاه', sub: 'MARKET', on: () => onTab('shop') },
    { img: UI2.btn_settings, label: 'تنظیمات', sub: 'SYSTEM', on: onSettings },
  ];
  const plateW = (W - 16 * 2 - 10) / 2;
  return (
    <ScrollView contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + 10 }} showsVerticalScrollIndicator={false}>
      {/* hero */}
      <View style={{ height: heroW * 1.02 + 40, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Pulse size={heroW * .7} color="rgba(79,140,255,.35)" style={{ top: heroW * .12 }} />
        <Orbit size={heroW * 1.15} />
        <Float amp={7} dur={3000}><Img src={UI2.hero} style={{ width: heroW, height: heroW }} /></Float>
        <Float amp={5} dur={2300} delay={400} style={{ position: 'absolute', left: 6, bottom: 10 }}>
          <Img src={UI2.mascot} style={{ width: W * .26, height: W * .26 * 1.25 }} />
        </Float>
        <Bubble style={{ position: 'absolute', left: W * .2, bottom: W * .26 * 1.2 + 6 }} text={p.played ? 'یه دست دیگه، کاپیتان؟' : 'سلام کاپیتان! آماده‌ای؟'} />
        <Float amp={4} dur={3400} delay={900} style={{ position: 'absolute', right: 10, bottom: 40 }}>
          <Img src={UI2.d_crystal} style={{ width: W * .14, height: W * .14 * 1.9 }} />
        </Float>
      </View>

      <Enter i={0} style={{ alignItems: 'center', marginTop: -6 }}>
        <T s="NEXORA" style={{ fontFamily: F.title, fontSize: 30, letterSpacing: 8, color: '#fff', textShadowColor: C.cyan, textShadowRadius: 16 }} />
        <T s="FINGER SOCCER · DEEP SPACE LEAGUE" style={{ fontFamily: F.head, fontSize: 8, letterSpacing: 3, color: C.cyan, marginTop: 2 }} />
      </Enter>

      <Enter i={1} style={{ paddingHorizontal: 16, marginTop: 14 }}>
        <PlayButton onPress={() => onMode(MODES[0])} />
      </Enter>
      <Enter i={1} style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <OnlineCard onOnline={onOnline} />
      </Enter>

      {/* league strip */}
      <Enter i={2} style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <Press onPress={() => onTab('profile')}>
          <Panel style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }} accent={C.gold}>
            <Img src={(UI as any)[MEDAL[Math.min(lg.idx, MEDAL.length - 1)]]} style={{ width: 52, height: 52 }} />
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <T s={`لیگ ${LEAGUE_FA[lg.name]}`} style={{ fontFamily: F.bold, fontSize: 15 }} />
                <T s={`${p.trophies} / ${lg.to}`} style={{ fontFamily: F.head, fontSize: 11, color: C.gold }} />
              </View>
              <View style={{ marginTop: 6 }}><Bar v={(p.trophies - lg.from) / (lg.to - lg.from)} color={C.gold} color2={C.orange} /></View>
            </View>
            <Img src={UI2.x_trophy} style={{ width: 44, height: 44 }} />
          </Panel>
        </Press>
      </Enter>

      {/* modes rail */}
      <Title s="حالت‌های بازی" en="GAME MODES" right={<Press onPress={() => onTab('play')}><T s="همه ›" style={{ color: C.cyan, fontSize: 12 }} /></Press>} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {MODES.map((m, i) => (
          <Enter key={m.k} i={i + 3}>
            <Press onPress={() => onMode(m)} style={[s.mode, { borderColor: m.color + '55' }]}>
              <LinearGradient colors={[m.color + '40', 'rgba(8,12,34,.2)', 'rgba(6,9,26,.95)']} style={StyleSheet.absoluteFill} />
              <Img src={m.img} style={{ width: 92, height: 92, marginTop: 6 }} />
              <T s={m.name} style={{ fontFamily: F.bold, fontSize: 13, marginTop: 2 }} />
              <T s={m.en} style={{ fontFamily: F.head, fontSize: 7, letterSpacing: 1.5, color: m.color, marginTop: 2 }} />
            </Press>
          </Enter>
        ))}
      </ScrollView>

      {/* menu plates */}
      <Title s="منو" en="COMMAND DECK" />
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' }}>
        {plates.map((pl, i) => (
          <Enter key={pl.label} i={i + 2} style={{ width: plateW, marginBottom: 8 }}>
            <Press onPress={pl.on} scaleTo={.96}>
              <View style={{ width: plateW, height: plateW * .43 }}>
                <Img src={pl.img} style={StyleSheet.absoluteFill} />
                <View style={[s.plateTxt, { left: plateW * .34 }]}>
                  <T s={pl.label} n={1} style={{ fontFamily: F.bold, fontSize: plateW < 170 ? 12 : 14, textShadowColor: '#0a3cff', textShadowRadius: 8 }} />
                  <T s={pl.sub} style={{ fontFamily: F.head, fontSize: 7, letterSpacing: 2, color: C.cyan }} />
                </View>
                {pl.dot ? <View style={s.dot} /> : null}
              </View>
            </Press>
          </Enter>
        ))}
      </View>

      {/* loadout */}
      <Title s="ترکیب فعلی" en="LOADOUT" right={<Press onPress={() => onTab('team')}><T s="ویرایش ›" style={{ color: C.cyan, fontSize: 12 }} /></Press>} />
      <Enter i={4} style={{ paddingHorizontal: 16 }}>
        <Press onPress={() => onTab('team')} scaleTo={.98}>
          <Panel style={{ flexDirection: 'row-reverse', padding: 12, alignItems: 'center' }}>
            <Load img={TEAM_IMG[teamKey(me)]} round label={me.name} sub="دیسک" />
            <Load img={BALL_IMG['b' + p.ball]} round label={BALL_NAMES[p.ball]} sub="توپ" />
            <Load img={FIELD_THUMB[FIELDS[p.field].id]} label={FIELDS[p.field].name} sub="زمین" />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Img src={UI2.x_tactics} style={{ width: 48, height: 48 }} />
              <T s={FORMS[p.form][0]} style={{ fontFamily: F.head, fontSize: 11, marginTop: 2 }} />
              <T s="ترکیب" style={{ fontSize: 10, color: C.dim }} />
            </View>
          </Panel>
        </Press>
      </Enter>

      {/* missions */}
      {pending.length ? <Title s="مأموریت‌ها" en="MISSIONS" right={<Press onPress={() => onTab('profile')}><T s="همه ›" style={{ color: C.cyan, fontSize: 12 }} /></Press>} /> : null}
      {pending.map((a, i) => {
        const cur = Math.min(a.max, a.cur(p)), done = cur >= a.max;
        return (
          <Enter key={a.id} i={i + 5} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Press onPress={() => onTab('profile')} scaleTo={.98}>
              <Panel style={{ flexDirection: 'row-reverse', alignItems: 'center', padding: 10 }} accent={done ? C.green : undefined}>
                <Img src={UI2[a.icon]} style={{ width: 46, height: 46 }} />
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                    <T s={a.name} style={{ fontFamily: F.bold, fontSize: 13 }} />
                    <T s={`${fa(cur)}/${fa(a.max)}`} style={{ fontSize: 11, color: done ? C.green : C.dim }} />
                  </View>
                  <T s={a.desc} style={{ fontSize: 11, color: C.dim, textAlign: 'right' }} />
                  <View style={{ marginTop: 5 }}><Bar v={cur / a.max} h={6} color={done ? C.green : C.cyan} /></View>
                </View>
                <View style={{ alignItems: 'center', width: 54 }}>
                  <Img src={UI2.c_coin} style={{ width: 26, height: 26 }} />
                  <T s={`+${a.coins}`} style={{ fontFamily: F.head, fontSize: 10, color: C.gold }} />
                </View>
              </Panel>
            </Press>
          </Enter>
        );
      })}
    </ScrollView>
  );
}
export default memo(Home);

function Load({ img, label, sub, round }: { img: any; label: string; sub: string; round?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Img src={img} style={round ? { width: 48, height: 48, borderRadius: 24 } : { width: 36, height: 48, borderRadius: 6 }} fit={round ? 'contain' : 'cover'} />
      <T s={label} n={1} style={{ fontFamily: F.bold, fontSize: 10, marginTop: 4, maxWidth: 76 }} />
      <T s={sub} style={{ fontSize: 10, color: C.dim }} />
    </View>
  );
}

function PlayButton({ onPress }: { onPress: () => void }) {
  const sh = useSharedValue(0);
  useEffect(() => { sh.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 900 })), -1, false); }, []);
  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + sh.value * 560 }, { rotate: '20deg' }] }));
  return (
    <Press onPress={onPress} scaleTo={.96}>
      <View style={s.play}>
        <LinearGradient colors={G.primary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(255,255,255,.4)', 'rgba(255,255,255,.05)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { height: '55%' }]} />
        <Animated.View style={[s.shine, shine]} />
        <Img src={UI2.x_ball} style={{ width: 54, height: 54, marginRight: 6 }} />
        <View style={{ alignItems: 'center' }}>
          <T s="شروع بازی" style={{ fontFamily: F.title, fontSize: 22, color: '#fff', textShadowColor: 'rgba(0,0,40,.5)', textShadowRadius: 8 }} />
          <T s="QUICK MATCH" style={{ fontFamily: F.head, fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,.85)' }} />
        </View>
      </View>
    </Press>
  );
}

function Orbit({ size }: { size: number }) {
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 360}deg` }, { scaleY: .32 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: size * .08, width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: 'rgba(92,225,255,.35)', borderStyle: 'dashed' }, a]} />
  );
}

function Bubble({ text, style }: { text: string; style?: any }) {
  return (
    <Float amp={3} dur={2000} style={style}>
      <View style={s.bubble}><T s={text} style={{ fontSize: 11, color: '#e8f6ff' }} /></View>
      <View style={s.bubbleTail} />
    </Float>
  );
}

const s = StyleSheet.create({
  play: { height: 74, borderRadius: 24, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,.5)', shadowColor: C.cyan, shadowOpacity: .7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
  shine: { position: 'absolute', top: -40, width: 60, height: 160, backgroundColor: 'rgba(255,255,255,.28)' },
  mode: { width: 124, height: 160, marginHorizontal: 5, borderRadius: 22, borderWidth: 1, overflow: 'hidden', alignItems: 'center', backgroundColor: 'rgba(8,12,34,.8)' },
  plateTxt: { position: 'absolute', right: '9%', top: 0, bottom: '8%', justifyContent: 'center', alignItems: 'center' },
  dot: { position: 'absolute', top: 6, right: 14, width: 11, height: 11, borderRadius: 6, backgroundColor: C.red, borderWidth: 2, borderColor: '#0b1236' },
  bubble: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(14,30,80,.92)', borderWidth: 1, borderColor: 'rgba(92,225,255,.5)' },
  bubbleTail: { position: 'absolute', bottom: -5, left: 14, width: 10, height: 10, backgroundColor: 'rgba(14,30,80,.92)', borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(92,225,255,.5)', transform: [{ rotate: '45deg' }] },
});
