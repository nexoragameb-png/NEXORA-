// ORACLE — NEXORA's cheeky in-app sidekick. Fully offline & rule-based (no AI service):
// it reads the local profile + online profile and picks a tip, a hint or a bit of banter in Persian.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { T } from './kit';
import { C, F, fa } from './theme';
import { buzz, sfx } from '../sound';
import { useStore, Profile } from '../store';
import { useAuth } from '../net/auth';
import type { OnlineProfile } from '../net/supabase';

const FACE = {
  hello: require('../../assets/g/oracle/oracle_hello.webp'), wave: require('../../assets/g/oracle/oracle_wave.webp'),
  idea: require('../../assets/g/oracle/oracle_idea.webp'), laugh: require('../../assets/g/oracle/oracle_laugh.webp'),
  happy: require('../../assets/g/oracle/oracle_happy.webp'), joy: require('../../assets/g/oracle/oracle_joy.webp'),
  alert: require('../../assets/g/oracle/oracle_alert.webp'), confused: require('../../assets/g/oracle/oracle_confused.webp'),
  curious: require('../../assets/g/oracle/oracle_curious.webp'), focus: require('../../assets/g/oracle/oracle_focus.webp'),
  hero: require('../../assets/g/oracle/oracle_hero.webp'), present: require('../../assets/g/oracle/oracle_present.webp'),
  sleep: require('../../assets/g/oracle/oracle_sleep.webp'), spin: require('../../assets/g/oracle/oracle_spin.webp'),
  calm: require('../../assets/g/oracle/oracle_calm.webp'), excited: require('../../assets/g/oracle/oracle_excited.webp'),
  idle: require('../../assets/g/oracle/oracle_idle.webp'), neutral: require('../../assets/g/oracle/oracle_neutral.webp'),
  content: require('../../assets/g/oracle/oracle_content.webp'),
};
export type Face = keyof typeof FACE;
export type Line = { t: string; f: Face; w: number };
type Ctx = { p: Profile; o: OnlineProfile | null; dailyReady: boolean; chestReady: boolean; hour: number };

const pick = <X,>(a: X[]) => a[Math.floor(Math.random() * a.length)];

// situational lines (weighted) — the more relevant, the heavier
export function oracleLines({ p, o, dailyReady, chestReady, hour }: Ctx): Line[] {
  const L: Line[] = [];
  const wr = p.played ? p.wins / p.played : 0;
  if (dailyReady) L.push({ t: 'جایزه‌ی روزانه‌ت همین‌جا خاک می‌خوره! بالا سمت چپ، تقویم رو بزن 😏', f: 'present', w: 9 });
  if (chestReady) L.push({ t: 'یه صندوقچه‌ی رایگان آماده‌ست. من جات بودم بازش می‌کردم… شاید هم خودم بازش کنم 🤭', f: 'excited', w: 8 });
  if (p.played === 0) L.push({ t: 'سلام تازه‌وارد! دیسکت رو بکش عقب و ول کن. فقط یادت باشه: با اولین ضربه‌ی بعد از شروع، گل حساب نمی‌شه!', f: 'hello', w: 10 });
  if (p.winStreak >= 3) L.push({ t: `${fa(p.winStreak)} برد پشت سر هم؟! داری غرورم رو جریحه‌دار می‌کنی 😤 برو آرنای دوئل ببینم چند مرده حلاجی!`, f: 'hero', w: 8 });
  if (p.losses > p.wins + 3) L.push({ t: 'یه راز بهت بگم؟ ربات آسان هم بعضی وقتا می‌بازه… مخصوصاً وقتی تو تمرین کنی 😇', f: 'laugh', w: 6 });
  if (wr > .65 && p.played > 10) L.push({ t: `درصد بردت ${fa(Math.round(wr * 100))}٪ـه. وقتشه جام جهانی ماهانه رو هدف بگیری 🏆`, f: 'joy', w: 6 });
  if (p.coins < 150) L.push({ t: 'جیبت خالیه رفیق 🪙 چالش‌های روزانه و بازی سریع سکه می‌دن. من قرض نمی‌دم!', f: 'confused', w: 7 });
  if (o) {
    if (o.gems >= 130) L.push({ t: `${fa(o.gems)} الماس داری و هنوز دیسک افسانه‌ای نخریدی؟ دیسک‌ها قدرت و دقت واقعی دارن، فقط ظاهر نیستن!`, f: 'idea', w: 6 });
    if (o.coins >= 2000) L.push({ t: 'با این همه سکه، آرنای فضا (۲۰۰۰ ورودی، ۴۰۰۰ جایزه) داره صدات می‌کنه 🚀 دل و جرئتش رو داری؟', f: 'excited', w: 6 });
    else if (o.coins >= 100) L.push({ t: 'آرنای برمودا: ۱۰۰ سکه بده، ۲۰۰ بگیر. ریاضیش ساده‌ست، بردنش نه 😈', f: 'curious', w: 4 });
    if (o.gems >= 50) L.push({ t: 'آرنای کاکرو با الماس بازی می‌کنه: ۵۰ بده، ۱۰۰ ببر. تا ۵ گل! قلبت ضعیف نیست؟', f: 'focus', w: 3 });
    if (!o.club_id) L.push({ t: 'هنوز باشگاه نداری؟ تنهایی خوش می‌گذره؟ برو بخش اجتماعی یه باشگاه پیدا کن، چالش تیمی بزنید!', f: 'wave', w: 4 });
    if (o.win_streak === 0 && o.losses > o.wins) L.push({ t: 'آنلاین سخت می‌گیری؟ زاویه رو آروم بگیر؛ دقت دیسک کم باشه، کشیدن زیاد یعنی خطای بیشتر.', f: 'calm', w: 4 });
  } else L.push({ t: 'هنوز آنلاین نشدی؟ مهمان هم می‌تونی وارد شی. اونجا آدمای واقعی منتظر شکستتن… یا شکست دادنت 😏', f: 'curious', w: 6 });
  if (hour >= 0 && hour < 6) L.push({ t: 'ساعت رو دیدی؟! من که خوابم میاد… ولی باشه، یه دست دیگه 😴', f: 'sleep', w: 7 });
  if (hour >= 6 && hour < 10) L.push({ t: 'صبح بخیر قهرمان ☀️ یه بازی گرم‌کن با ربات؟', f: 'happy', w: 3 });
  // gameplay tips
  for (const t of [
    'قدرت دیسک (۱ تا ۱۰) سرعت شوت رو تا ۲۵٪ بیشتر یا کمتر می‌کنه. دقت، خطای زاویه و طول خط پیش‌نمایش رو.',
    'شوت مستقیم به توپ همیشه بهترین نیست؛ گاهی یه پاس کمانه‌ای از دیواره دروازه رو باز می‌کنه.',
    'وقتی جلویی، دیسک‌ها رو جلوی دروازه بچین. دفاع هم هنر خودشه 🛡️',
    'تو بازی‌های زمان‌دار، اگه مساوی تموم شه می‌ره گل طلایی. نفس عمیق!',
    'تنظیمات → کیفیت «روان» رو بزن اگه گوشیت داغ می‌کنه. من خودم هم گاهی داغ می‌کنم 🔥',
    'دیسک‌های باشگاهی رایگانن ولی متوسط. دیسک‌های VIP و افسانه‌ای قدرت ۸ تا ۱۰ دارن.',
    'جام جهانی ماهانه: ۶۴ نفر اول رده‌بندی همون ماه، ۱۶ گروه، بعد حذفی. قهرمان ۵۰۰ الماس می‌بره!',
  ]) L.push({ t, f: 'idea', w: 2 });
  // pure banter
  for (const t of ['من اوراکل‌ام. همه چیز رو می‌دونم… جز این‌که چرا اون شوت رو زدی 🤨', 'اگه ببری، می‌گم خودم یادت دادم. اگه ببازی، من اصلاً این‌جا نبودم 🙈',
    'یه بار با ربات سخت بازی کردم… هنوز دارم گریه می‌کنم 🥲', 'به من دست نزن! …باشه، یکی دیگه بزن 😆', 'شایعه شده توپ‌ها تو این بازی حس دارن. من تأیید نمی‌کنم 🤐'])
    L.push({ t, f: pick(['laugh', 'spin', 'content', 'neutral'] as Face[]), w: 1 });
  return L;
}
const weighted = (L: Line[], not?: string) => {
  const pool = L.filter(l => l.t !== not); const sum = pool.reduce((a, b) => a + b.w, 0); let x = Math.random() * sum;
  for (const l of pool) { x -= l.w; if (x <= 0) return l; } return pool[0] || L[0];
};

function Oracle({ size, dailyReady, chestReady, side = 'left' }: { size: number; dailyReady: boolean; chestReady: boolean; side?: 'left' | 'right' }) {
  const { p } = useStore(); const { profile } = useAuth();
  const ctx = useMemo(() => ({ p, o: profile, dailyReady, chestReady, hour: new Date().getHours() }), [p.played, p.coins, p.winStreak, p.losses, profile?.gems, profile?.coins, profile?.club_id, dailyReady, chestReady]);
  const [line, setLine] = useState<Line | null>(null);
  const [face, setFace] = useState<Face>('idle');
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bob = useSharedValue(0), pop = useSharedValue(1);
  useEffect(() => { bob.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  const say = useCallback((l: Line) => {
    setLine(l); setFace(l.f);
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => { setLine(null); setFace('idle'); }, 6500);
  }, []);
  // greets once, a moment after Home appears, with the most relevant line
  useEffect(() => { const id = setTimeout(() => { const L = oracleLines(ctx); say(L.sort((a, b) => b.w - a.w)[0]); }, 1400); return () => { clearTimeout(id); if (hide.current) clearTimeout(hide.current); }; }, []);
  const tap = () => {
    pop.value = withSequence(withSpring(1.15, { damping: 6 }), withSpring(1, { damping: 8 }));
    sfx('ui'); buzz('light'); say(weighted(oracleLines(ctx), line?.t));
  };
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * bob.value }, { rotate: `${(bob.value - .5) * 4}deg` }, { scale: pop.value }] }));
  return (
    <View style={{ width: size, height: size * 1.1 }} pointerEvents="box-none">
      {line ? (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={[s.bubble, side === 'left' ? { left: size * .55 } : { right: size * .55 }, { bottom: size * .95 }]}>
          <T s={line.t} style={{ fontSize: 12, lineHeight: 19, textAlign: 'right', color: '#eaf4ff' }} />
          <T s="اوراکل" style={{ fontFamily: F.bold, fontSize: 9, color: C.violet, textAlign: 'left', marginTop: 2 }} />
        </Animated.View>
      ) : null}
      <Pressable onPress={tap} hitSlop={8} accessibilityLabel="اوراکل">
        <Animated.View style={st}>
          <Image source={FACE[face]} style={{ width: size, height: size * 1.1 }} contentFit="contain" cachePolicy="memory-disk" transition={120} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
export default memo(Oracle);

const s = StyleSheet.create({
  bubble: { position: 'absolute', width: 230, padding: 10, borderRadius: 16, backgroundColor: 'rgba(16,14,48,.96)', borderWidth: 1, borderColor: C.violet + 'aa', shadowColor: C.violet, shadowOpacity: .6, shadowRadius: 12, elevation: 12, zIndex: 20 },
});
