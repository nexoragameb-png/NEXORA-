import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useStore } from '../store';
import { Btn, Enter, Panel, Segment, T, Toggle, rowDir, startAlign, textStart } from '../ui/kit';
import { Icon } from '../ui/vec/Icon';
import { getLang, tr } from '../i18n';
import { useSky } from '../ui/daytime';
import { C, F, G } from '../ui/theme';
import Account from './Account';

export default function Settings({ toast, replayIntro }: { toast: (m: string, k?: string) => void; replayIntro: () => void }) {
  const { p, set, reset } = useStore(); const [sure, setSure] = useState(false);
  const sky = useSky();
  const rows: [string, string, string, 'sound' | 'music' | 'haptics'][] = [
    ['sound', tr('صداها', 'Sound effects'), tr('ضربه، گل، تماشاگر', 'Hits, goals, crowd'), 'sound'], ['music', tr('موسیقی', 'Music'), tr('موسیقی منو', 'Menu music'), 'music'], ['vibe', tr('لرزش', 'Vibration'), tr('بازخورد لمسی هنگام برخورد', 'Haptic feedback on hits'), 'haptics'],
  ];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Enter i={0}>
        <Panel style={{ padding: 12, marginBottom: 10 }} accent="#a43bff">
          <View style={{ flexDirection: rowDir(), alignItems: 'center', marginBottom: 8 }}>
            <Icon name="lang" size={36} />
            <View style={{ flex: 1, marginHorizontal: 10, alignItems: startAlign() }}>
              <T s="زبان · Language" raw style={{ fontFamily: F.bold, fontSize: 15 }} />
              <T s={tr('پیش‌فرض: زبان گوشی', 'Default: device language')} style={{ color: C.dim, fontSize: 11 }} />
            </View>
          </View>
          <Segment value={p.lang || ''} onChange={v => set({ lang: v })} items={[['', tr('خودکار', 'Auto')], ['fa', 'فارسی'], ['en', 'English']]} accent="#a43bff" />
        </Panel>
      </Enter>
      <Enter i={0}>
        <Panel style={{ padding: 12, marginBottom: 10, flexDirection: rowDir(), alignItems: 'center' }} accent={sky.accent}>
          <Icon name={sky.k === 'day' || sky.k === 'dawn' ? 'sun' : 'moon'} size={36} />
          <View style={{ flex: 1, marginHorizontal: 10, alignItems: startAlign() }}>
            <T s={tr(`حالت روز و شب: ${sky.label[0]}`, `Day / night: ${sky.label[1]}`)} style={{ fontFamily: F.bold, fontSize: 14 }} />
            <T s={tr('آسمان، نور ورزشگاه و آب‌وهوا خودکار با ساعت گوشی عوض می‌شن', 'Sky, stadium lights and weather follow your local time')} n={2} style={{ color: C.dim, fontSize: 11, textAlign: textStart() }} />
          </View>
        </Panel>
      </Enter>
      <Enter i={0}><Account toast={toast} /></Enter>
      {rows.map(([img, n, d, k], i) => (
        <Enter key={k} i={i}>
          <Panel style={{ marginBottom: 10, padding: 12, flexDirection: rowDir(), alignItems: 'center' }} accent="transparent">
            <Icon name={img} size={36} plate />
            <View style={{ flex: 1, marginHorizontal: 10, alignItems: startAlign() }}><T s={n} style={{ fontFamily: F.bold, fontSize: 15 }} /><T s={d} style={{ color: C.dim, fontSize: 11, marginTop: 1 }} /></View>
            <Toggle on={!!p[k]} onChange={v => set({ [k]: v } as any)} />
          </Panel>
        </Enter>
      ))}
      <Enter i={3}>
        <Panel style={{ padding: 12, marginBottom: 10 }} accent="transparent">
          <T s="بلندی صدا" style={{ fontFamily: F.bold, fontSize: 15, textAlign: 'right', marginBottom: 8 }} />
          <Segment value={p.volume ?? 1} onChange={v => set({ volume: v })} items={[[0.25, tr('۲۵٪', '25%')], [0.5, tr('۵۰٪', '50%')], [0.75, tr('۷۵٪', '75%')], [1, tr('۱۰۰٪', '100%')]]} accent={C.cyan} />
        </Panel>
      </Enter>
      <Enter i={3}>
        <Panel style={{ padding: 12, marginBottom: 10 }} accent="transparent">
          <T s="کیفیت گرافیک" style={{ fontFamily: F.bold, fontSize: 15, textAlign: 'right' }} />
          <T s="روی گوشی‌های ضعیف «روان» را انتخاب کن" style={{ color: C.dim, fontSize: 11, textAlign: 'right', marginBottom: 8 }} />
          <Segment value={p.quality} onChange={v => set({ quality: v })} items={[['high', 'بالا'], ['low', 'روان']]} accent={C.violet} />
        </Panel>
      </Enter>
      <Enter i={4}>
        <Panel style={{ padding: 12, marginBottom: 10 }} accent="transparent">
          <T s="سختی پیش‌فرض ربات" style={{ fontFamily: F.bold, fontSize: 15, textAlign: 'right', marginBottom: 8 }} />
          <Segment value={p.aiLvl} onChange={v => set({ aiLvl: v })} items={[[0, 'آسان'], [1, 'معمولی'], [2, 'سخت']]} />
        </Panel>
      </Enter>
      <View style={{ marginTop: 8 }}><Btn label="پخش دوباره‌ی اینترو" small colors={G.dark} onPress={replayIntro} /></View>
      <View style={{ marginTop: 10 }}>
        <Btn label={sure ? 'مطمئنی؟ دوباره بزن' : 'پاک کردن پیشرفت'} small colors={G.red} onPress={() => { if (!sure) { setSure(true); return; } reset(); setSure(false); toast('پیشرفت پاک شد', 'ok'); }} />
      </View>
      <T s="NEXORA · Finger Soccer · v3.0.0" style={{ fontFamily: F.head, textAlign: 'center', color: C.dim2, fontSize: 10, letterSpacing: 2, marginTop: 24 }} />
    </ScrollView>
  );
}
