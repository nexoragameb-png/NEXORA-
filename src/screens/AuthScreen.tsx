// Full-screen account gate: sign up (username + e-mail + password) / sign in / forgot password,
// plus "continue as guest". Shown once after the intro for players without an e-mail account, and
// reachable any time from the Profile tab, the HUD avatar and Settings.
import { xl } from '../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { UI2 } from '../game/assets';
import { Btn, Img, Panel, Press, Segment, T, rowDir, startAlign } from '../ui/kit';
import Space from '../ui/Space';
import { C, F, G } from '../ui/theme';
import { buzz } from '../sound';
import { useAuth } from '../net/auth';
import { Field, S, TS } from '../online/ui';

type Mode = 'up' | 'in' | 'forgot';
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const nameOk = (n: string) => /^[A-Za-z0-9_.\- \u0600-\u06FF\u200c]{3,20}$/.test(n.trim());

export default function AuthScreen({ onClose, toast, initial = 'up' }: { onClose: () => void; toast: (m: string, k?: string) => void; initial?: Mode }) {
  const a = useAuth(); const ins = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initial);
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [pass, setPass] = useState(''); const [pass2, setPass2] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [nameFree, setNameFree] = useState<boolean | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // live username availability (debounced)
  useEffect(() => {
    setNameFree(null);
    if (mode !== 'up' || !nameOk(name)) return;
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => { a.usernameFree(name).then(setNameFree, () => setNameFree(null)); }, 450);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [name, mode]);

  const signedEmail = !!a.uid && !a.isGuest;
  const validate = () => {
    const e: Record<string, string | null> = {};
    if (mode === 'up') {
      if (!nameOk(name)) e.name = 'نام کاربری ۳ تا ۲۰ کاراکتر؛ فقط حروف، عدد، فاصله و _ . -';
      else if (nameFree === false) e.name = 'این نام کاربری قبلاً گرفته شده';
    }
    if (!emailOk(email)) e.email = 'ایمیل معتبر نیست';
    if (mode !== 'forgot' && pass.length < 6) e.pass = 'رمز عبور حداقل ۶ کاراکتر';
    if (mode === 'up' && pass !== pass2) e.pass2 = 'تکرار رمز عبور یکسان نیست';
    setErrs(e); return !Object.values(e).some(Boolean);
  };

  const submit = async () => {
    setErr(null); setInfo(null);
    if (!validate()) { buzz('medium'); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const r = await a.resetPassword(email);
        if (!r.ok) { setErr(r.error); return; }
        setInfo('لینک تغییر رمز به ایمیلت فرستاده شد. لینک را روی همین گوشی باز کن.'); return;
      }
      if (mode === 'in') {
        const r = await a.signIn(email, pass);
        if (!r.ok) { setErr(r.error); buzz('heavy'); return; }
        buzz('success'); toast('خوش برگشتی! وارد شدی', 'ok'); onClose(); return;
      }
      // sign up: a guest keeps their id and progress (upgrade); otherwise a fresh account
      if (nameFree === null) { const f = await a.usernameFree(name); if (f === false) { setErrs({ name: 'این نام کاربری قبلاً گرفته شده' }); return; } }
      const r = a.uid && a.isGuest ? await a.upgrade(email, pass, name) : await a.signUp(email, pass, name);
      if (!r.ok) { setErr(r.error); buzz('heavy'); return; }
      if (r.info === 'confirm') { setInfo('حسابت ساخته شد! لینک تأیید را در ایمیلت باز کن، سپس وارد شو.'); setMode('in'); return; }
      buzz('success'); toast(`حسابت ساخته شد · خوش اومدی ${name.trim()}!`, 'ok'); onClose();
    } finally { setBusy(false); }
  };

  const guest = async () => {
    setBusy(true);
    try { await a.ensure(); toast('به‌عنوان مهمان ادامه می‌دهی · هر وقت خواستی از پروفایل ثبت‌نام کن', 'ok'); } catch { /* offline: still let them play */ }
    finally { setBusy(false); onClose(); }
  };

  const pwStyle = { textAlign: 'left' as const, writingDirection: 'ltr' as const };
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { zIndex: 80, backgroundColor: C.bg }]}>
      <Space theme="portal" dim={.12} stars={false} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: ins.top + S.l, paddingBottom: ins.bottom + S.xl, paddingHorizontal: S.l }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: rowDir(), justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ alignItems: startAlign() }}>
              <T s="NEXORA ACCOUNT" style={{ fontFamily: F.head, fontSize: 10, letterSpacing: 3, color: C.cyan }} />
              <T s={signedEmail ? 'حساب تو' : mode === 'in' ? 'ورود به حساب' : mode === 'forgot' ? 'بازیابی رمز عبور' : 'ساخت حساب جدید'} style={{ fontFamily: F.title, fontSize: 24, marginTop: 2 }} />
            </View>
            <Press onPress={onClose} style={s.close}><T s="✕" style={{ fontSize: 16 }} /></Press>
          </View>

          {signedEmail ? (
            <Panel style={{ padding: S.l, marginTop: S.l }} accent={C.green} glow>
              <T s={`با ${a.email} وارد شده‌ای`} style={{ fontFamily: F.bold, fontSize: TS.body, textAlign: 'right' }} />
              <T s={`نام کاربری: ${a.profile?.username || '…'}`} style={{ color: C.dim, fontSize: TS.small, textAlign: 'right', marginTop: 4 }} />
              <Btn label="ادامه" onPress={onClose} style={{ marginTop: S.l }} />
              <Btn label="خروج از حساب" small colors={G.red} style={{ marginTop: S.s }} onPress={async () => { await a.signOut(); toast('از حساب خارج شدی', 'ok'); }} />
            </Panel>
          ) : (
            <Panel style={{ padding: S.l, marginTop: S.l }} accent={C.violet} glow>
              <View style={{ alignItems: 'center', marginBottom: S.m }}>
                <Img src={UI2.c_profile} style={{ width: 64, height: 64 }} />
                <T s={mode === 'up' ? (a.isGuest ? 'حساب مهمانت را ثبت کن تا پیشرفتت روی هر گوشی بماند' : 'با یک حساب، دیسک‌ها، الماس‌ها و رتبه‌ات روی سرور ذخیره می‌شود')
                  : mode === 'in' ? 'با ایمیل و رمز عبورت وارد شو' : 'ایمیل حسابت را وارد کن تا لینک تغییر رمز برایت ارسال شود'}
                  style={{ color: C.dim, fontSize: TS.small, textAlign: 'center', marginTop: S.s, lineHeight: 20 }} />
              </View>
              {mode !== 'forgot' ? (
                <Segment value={mode} onChange={v => { setMode(v); setErr(null); setErrs({}); setInfo(null); }} items={[['up', 'ثبت‌نام'], ['in', 'ورود']]} accent={C.violet} />
              ) : null}
              <View style={{ height: S.m }} />
              {mode === 'up' ? (
                <Field label="نام کاربری" placeholder={xl("مثلاً NexoraKing")} value={name} onChangeText={t => { setName(t); setErrs(e => ({ ...e, name: null })); }} maxLength={20} autoCapitalize="none" autoCorrect={false}
                  error={errs.name || (nameFree === false ? 'این نام کاربری قبلاً گرفته شده' : null)} />
              ) : null}
              {mode === 'up' && nameFree && nameOk(name) && !errs.name ? <T s="✓ این نام آزاد است" style={{ color: C.green, fontSize: TS.cap, textAlign: 'right', marginTop: -S.s, marginBottom: S.s }} /> : null}
              <Field label="ایمیل" placeholder="you@example.com" value={email} onChangeText={t => { setEmail(t); setErrs(e => ({ ...e, email: null })); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                autoComplete="email" textContentType="emailAddress" style={pwStyle} error={errs.email} />
              {mode !== 'forgot' ? (
                <Field label="رمز عبور" placeholder={xl("حداقل ۶ کاراکتر")} value={pass} onChangeText={t => { setPass(t); setErrs(e => ({ ...e, pass: null })); }} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false}
                  textContentType={mode === 'up' ? 'newPassword' : 'password'} style={pwStyle} error={errs.pass} />
              ) : null}
              {mode === 'up' ? (
                <Field label="تکرار رمز عبور" value={pass2} onChangeText={t => { setPass2(t); setErrs(e => ({ ...e, pass2: null })); }} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} style={pwStyle} error={errs.pass2} />
              ) : null}
              {mode !== 'forgot' ? (
                <Press onPress={() => setShow(v => !v)} style={{ alignSelf: 'flex-end', minHeight: 36, justifyContent: 'center', marginTop: -S.s }}>
                  <T s={show ? '🙈 پنهان کردن رمز' : '👁 نمایش رمز'} style={{ color: C.sky, fontSize: TS.cap }} />
                </Press>
              ) : null}
              {err ? <View style={s.err}><T s={err} style={{ color: '#ffd0d6', fontSize: TS.small, textAlign: 'right' }} /></View> : null}
              {info ? <View style={s.info}><T s={info} style={{ fontSize: TS.small, textAlign: 'right', lineHeight: 22 }} /></View> : null}
              <Btn label={busy ? 'لطفاً صبر کن…' : mode === 'up' ? (a.isGuest ? 'ثبت‌نام و حفظ پیشرفت' : 'ساخت حساب') : mode === 'in' ? 'ورود' : 'ارسال لینک بازیابی'}
                onPress={submit} disabled={busy} colors={mode === 'in' ? G.primary : mode === 'up' ? G.green : G.violet} style={{ marginTop: S.m }} />
              <View style={{ flexDirection: rowDir(), justifyContent: 'space-between', marginTop: S.m }}>
                {mode === 'forgot' ? (
                  <Press onPress={() => { setMode('in'); setErr(null); setInfo(null); }} style={s.link}><T s="بازگشت به ورود" style={{ color: C.cyan, fontSize: TS.small }} /></Press>
                ) : mode === 'in' ? (<>
                  <Press onPress={() => { setMode('up'); setErr(null); }} style={s.link}><T s="حساب نداری؟ ثبت‌نام کن" style={{ color: C.cyan, fontSize: TS.small }} /></Press>
                  <Press onPress={() => { setMode('forgot'); setErr(null); }} style={s.link}><T s="رمز را فراموش کردی؟" style={{ color: C.dim, fontSize: TS.small }} /></Press>
                </>) : (
                  <Press onPress={() => { setMode('in'); setErr(null); }} style={s.link}><T s="قبلاً ثبت‌نام کردی؟ وارد شو" style={{ color: C.cyan, fontSize: TS.small }} /></Press>
                )}
              </View>
            </Panel>
          )}

          {!signedEmail ? (
            <Btn label={a.uid ? 'فعلاً به‌عنوان مهمان ادامه بده' : 'ادامه به‌عنوان مهمان'} small colors={G.dark} onPress={guest} disabled={busy} style={{ marginTop: S.l }} />
          ) : null}
          <T s="ورود مهمان هم آنلاین بازی می‌کند، ولی با حذف برنامه یا عوض کردن گوشی پیشرفتش از دست می‌رود." style={{ color: C.dim2, fontSize: TS.cap, textAlign: 'center', marginTop: S.m, lineHeight: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  close: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,14,40,.85)', borderWidth: 1, borderColor: C.line },
  err: { padding: S.m, borderRadius: 14, backgroundColor: 'rgba(255,60,90,.12)', borderWidth: 1, borderColor: C.red + '66', marginTop: S.s },
  info: { padding: S.m, borderRadius: 14, backgroundColor: 'rgba(61,255,168,.08)', borderWidth: 1, borderColor: C.green + '55', marginTop: S.s },
  link: { minHeight: 40, justifyContent: 'center' },
});
