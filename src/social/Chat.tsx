// Conversation screen: DM / group / channel / club chat with realtime messages, image upload, read receipts, mute/leave.
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { UI2 } from '../game/assets';
import { Img, Press, T } from '../ui/kit';
import { C, F, fa } from '../ui/theme';
import { buzz, sfx } from '../sound';
import { useAuth } from '../net/auth';
import { errFa, rpc, supabase } from '../net/supabase';
import { pickAndUpload } from '../net/media';
import { useNav } from '../nav';
import { Avatar, Header, S, Spinner, TS } from '../online/ui';
import { KIND_LABEL, isOnline, timeAgo } from './Social';

type Msg = { id: number; conversation_id: string; sender: string | null; body: string | null; image_url: string | null; deleted: boolean; created_at: string };
type Member = { user_id: string; role: string; muted: boolean; profiles: { username: string; avatar: string; avatar_url: string | null; online_at: string } | null };
type Conv = { id: string; kind: 'dm' | 'group' | 'channel' | 'club'; title: string | null; about: string | null; is_public: boolean; club_id: string | null };

export default function Chat({ id, onBack, toast }: { id: string; onBack: () => void; toast: (m: string, k?: string) => void }) {
  const ins = useSafeAreaInsets(); const { uid } = useAuth(); const nav = useNav();
  const [conv, setConv] = useState<Conv | null>(null);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const markRead = useCallback(() => { if (uid) supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', id).eq('user_id', uid).then(() => {}, () => {}); }, [id, uid]);
  const load = useCallback(async () => {
    const [c, m, ms] = await Promise.all([
      supabase.from('conversations').select('id, kind, title, about, is_public, club_id').eq('id', id).maybeSingle(),
      supabase.from('conversation_members').select('user_id, role, muted, profiles(username, avatar, avatar_url, online_at)').eq('conversation_id', id).limit(300),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(80),
    ]);
    if (c.error || !c.data) { toast('این گفتگو در دسترس نیست', 'err'); onBack(); return; }
    setConv(c.data as Conv);
    const mm: Record<string, Member> = {}; for (const x of (m.data || []) as any[]) mm[x.user_id] = x; setMembers(mm);
    setMsgs((ms.data || []) as Msg[]); markRead();
  }, [id]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, ({ new: n }) => {
        const m = n as Msg; setMsgs(l => (l && !l.some(x => x.id === m.id) ? [m, ...l] : l || [m])); if (m.sender !== uid) sfx('chat'); markRead();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, ({ new: n }) => {
        const m = n as Msg; setMsgs(l => (l ? l.map(x => (x.id === m.id ? m : x)) : l));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const me = uid ? members[uid] : undefined;
  const canPost = !!me && (conv?.kind !== 'channel' || me.role === 'owner' || me.role === 'admin');
  const peer = conv?.kind === 'dm' ? Object.values(members).find(m => m.user_id !== uid) : undefined;
  const title = conv?.kind === 'dm' ? peer?.profiles?.username || 'گفتگو' : conv?.title || KIND_LABEL[conv?.kind || 'group'];
  const sub = conv?.kind === 'dm' ? (isOnline(peer?.profiles?.online_at) ? 'آنلاین' : peer ? `آخرین بازدید ${timeAgo(peer.profiles?.online_at)} پیش` : '') : `${KIND_LABEL[conv?.kind || 'group']} · ${fa(Object.keys(members).length)} عضو`;

  const send = async (body: string | null, image_url: string | null = null) => {
    if (!uid || sending) return; setSending(true);
    const { data, error } = await supabase.from('messages').insert({ conversation_id: id, sender: uid, body, image_url }).select('*').single();
    setSending(false);
    if (error) { toast(errFa(error), 'err'); buzz('heavy'); return; }
    setMsgs(l => (l && !l.some(x => x.id === (data as Msg).id) ? [data as Msg, ...l] : l)); buzz('light');
  };
  const sendText = () => { const t = text.trim().slice(0, 2000); if (!t) return; setText(''); send(t); };
  const sendImage = async () => {
    if (!uid) return; const r = await pickAndUpload('chat', uid, { size: 1280 });
    if (r.ok) send(null, r.url); else if (!r.cancelled) toast(r.error, 'err');
  };
  const del = async (m: Msg) => { const { error } = await supabase.from('messages').update({ deleted: true, body: null }).eq('id', m.id); if (error) toast(errFa(error), 'err'); };
  const leave = async () => { setMenu(false); try { await rpc('leave_conversation', { p_conv: id }); toast('از گفتگو خارج شدی', 'ok'); onBack(); } catch (e) { toast(errFa(e), 'err'); } };
  const mute = async () => { setMenu(false); if (!uid || !me) return; await supabase.from('conversation_members').update({ muted: !me.muted }).eq('conversation_id', id).eq('user_id', uid); load(); };
  const join = async () => { try { await rpc('join_conversation', { p_conv: id }); load(); } catch (e) { toast(errFa(e), 'err'); } };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={title} en={sub} onBack={onBack} accent={conv?.kind === 'club' ? C.gold : conv?.kind === 'channel' ? C.violet : C.cyan}
        right={<Press onPress={() => (conv?.kind === 'dm' && peer ? nav.openProfile(peer.user_id) : setMenu(m => !m))} style={st.hBtn}>
          {conv?.kind === 'dm' && peer ? <Avatar avatar={peer.profiles?.avatar} url={peer.profiles?.avatar_url} size={34} /> : <T s="⋯" style={{ fontSize: 20 }} />}
        </Press>} />
      {menu ? (
        <View style={[st.menu, { top: ins.top + 70 }]}>
          {conv?.club_id ? <Press onPress={() => { setMenu(false); nav.openClub(conv.club_id!); }} style={st.mi}><T s="صفحه‌ی باشگاه" style={st.miT} /></Press> : null}
          {me ? <Press onPress={mute} style={st.mi}><T s={me.muted ? 'روشن کردن اعلان' : 'بی‌صدا'} style={st.miT} /></Press> : null}
          {me && conv?.kind !== 'club' && conv?.kind !== 'dm' ? <Press onPress={leave} style={st.mi}><T s="خروج از گفتگو" style={[st.miT, { color: C.red }]} /></Press> : null}
        </View>
      ) : null}
      {!msgs ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Spinner /></View> : (
        <FlatList ref={listRef} data={msgs} inverted keyExtractor={m => String(m.id)} keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => <Bubble m={item} mine={item.sender === uid} group={conv?.kind !== 'dm'} member={item.sender ? members[item.sender] : undefined}
            showName={!msgs[index + 1] || msgs[index + 1].sender !== item.sender} onLong={item.sender === uid && !item.deleted ? () => del(item) : undefined}
            onAvatar={item.sender && item.sender !== uid ? () => nav.openProfile(item.sender!) : undefined} />}
          contentContainerStyle={{ paddingHorizontal: S.m, paddingTop: S.m, paddingBottom: ins.top + 80 }}
          ListFooterComponent={conv?.about ? <T s={conv.about} style={{ fontSize: TS.cap, color: C.dim, textAlign: 'center', marginBottom: S.m }} /> : undefined}
          initialNumToRender={20} windowSize={9} />
      )}
      <View style={[st.bar, { paddingBottom: Math.max(ins.bottom, S.s) }]}>
        {!me && conv?.is_public ? <Press onPress={join} style={st.join}><T s="عضویت" style={{ fontFamily: F.bold, color: '#fff' }} /></Press>
          : !canPost ? <T s="فقط مدیران کانال می‌توانند پیام بفرستند" style={{ flex: 1, textAlign: 'center', color: C.dim, fontSize: TS.small, paddingVertical: S.m }} /> : (
            <>
              <Press onPress={sendText} disabled={!text.trim() || sending} style={[st.send, !text.trim() && { opacity: .4 }]}><T s="➤" style={{ fontSize: 18, color: '#fff', transform: [{ scaleX: -1 }] }} /></Press>
              <TextInput value={text} onChangeText={setText} placeholder="پیام…" placeholderTextColor={C.dim2} style={st.input} multiline maxLength={2000} textAlign="right" />
              <Press onPress={sendImage} style={st.icon}><Img src={UI2.c_gift} style={{ width: 26, height: 26 }} /></Press>
            </>
          )}
      </View>
    </KeyboardAvoidingView>
  );
}

const Bubble = memo(function Bubble({ m, mine, group, member, showName, onLong, onAvatar }: { m: Msg; mine: boolean; group: boolean; member?: Member; showName: boolean; onLong?: () => void; onAvatar?: () => void }) {
  if (!m.sender) return <View style={st.sys}><T s={m.body || ''} style={{ fontSize: TS.cap, color: C.gold, textAlign: 'center' }} /></View>;
  const time = new Date(m.created_at); const hh = `${fa(time.getHours())}:${String(time.getMinutes()).padStart(2, '0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])}`;
  return (
    <Animated.View entering={FadeInUp.duration(180)} style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', marginBottom: 6 }}>
      {!mine && group ? (showName ? <Press onPress={onAvatar} sound={false}><Avatar avatar={member?.profiles?.avatar} url={member?.profiles?.avatar_url} size={30} /></Press> : <View style={{ width: 30 }} />) : null}
      <Press onLongPress={onLong} sound={false} haptic={false} scaleTo={.98} style={[st.bubble, mine ? st.mine : st.theirs]}>
        {!mine && group && showName ? <T s={member?.profiles?.username || '…'} style={{ fontFamily: F.bold, fontSize: TS.tiny, color: C.cyan, marginBottom: 2 }} /> : null}
        {m.deleted ? <T s="پیام حذف شد" style={{ fontSize: TS.small, color: C.dim2 }} /> : (
          <>
            {m.image_url ? <Image source={{ uri: m.image_url }} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: m.body ? 4 : 0 }} contentFit="cover" cachePolicy="memory-disk" /> : null}
            {m.body ? <T s={m.body} style={{ fontSize: TS.body, lineHeight: 22 }} /> : null}
          </>
        )}
        <T s={hh} style={{ fontSize: 9, color: C.dim, marginTop: 2, textAlign: mine ? 'left' : 'right' }} />
      </Press>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  hBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,14,40,.85)', borderWidth: 1, borderColor: C.line },
  menu: { position: 'absolute', right: S.l, zIndex: 40, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: 'rgba(8,12,34,.98)', minWidth: 170 },
  mi: { height: 46, justifyContent: 'center', paddingHorizontal: S.m },
  miT: { fontFamily: F.bold, fontSize: TS.small, textAlign: 'right' },
  bubble: { maxWidth: '78%', paddingHorizontal: S.m, paddingVertical: 8, borderRadius: 18, marginHorizontal: 6 },
  mine: { backgroundColor: 'rgba(42,110,255,.55)', borderBottomRightRadius: 4 },
  theirs: { backgroundColor: 'rgba(20,28,64,.92)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.line },
  sys: { alignSelf: 'center', paddingHorizontal: S.m, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,210,87,.1)', marginVertical: 6, maxWidth: '90%' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: S.s, paddingTop: S.s, borderTopWidth: 1, borderColor: C.line, backgroundColor: 'rgba(4,6,20,.96)' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 18, paddingHorizontal: S.m, paddingVertical: 10, marginHorizontal: 6, color: C.text, fontFamily: F.body, fontSize: TS.body, backgroundColor: 'rgba(14,20,52,.95)', borderWidth: 1, borderColor: C.line },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  join: { flex: 1, height: 48, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
