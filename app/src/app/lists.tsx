import { useState } from 'react';
import { FlatList, Linking, Pressable, Text, View } from 'react-native';
import { api, changes, type Wish } from '../lib/api';
import { useList } from '../lib/useList';
import { useSession } from '../lib/session';
import { BackHeader } from '../components/BackHeader';
import { animateList } from '../lib/motion';
import { Button, Card, Check, Chips, Empty, ErrorBar, Fab, Field, Icon, Loading, Sheet, styles as ui, useForm } from '../components/ui';
import { money, toCents } from '../lib/dates';
import { C, S } from '../lib/theme';

const LISTS = [
  { value: 'want', label: 'Wants', empty: 'Things you both have your eye on, like a stand mixer or a weekend away.' },
  { value: 'need', label: 'Needs', empty: 'Things the house needs soon, like a new kettle or towels.' },
  { value: 'gift', label: 'Gift ideas', empty: 'Gift ideas for family and friends, with who each one suits.' },
];

type Draft = { id?: string; list: string; title: string; url: string; price: string; for_whom: string; notes: string; status: string };

export default function Lists() {
  const { memberColor, memberName } = useSession();
  const [list, setList] = useState('want');
  const { data, setData, loading, error, reload } = useList<Wish>(`/api/wishes?list=${list}`, 'wishes');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, set } = useForm<Draft>(draft ?? { list, title: '', url: '', price: '', for_whom: '', notes: '', status: 'open' }, [draft]);

  const open = data.filter((w) => w.status !== 'done');
  const done = data.filter((w) => w.status === 'done');
  const total = open.reduce((s, w) => s + (w.price_cents ?? 0), 0);

  async function toggle(w: Wish) {
    const status = w.status === 'done' ? 'open' : 'done';
    animateList();
    setData((d) => d.map((x) => (x.id === w.id ? { ...x, status } : x)));
    api(`/api/wishes/${w.id}`, { method: 'PATCH', body: { status } }).catch(reload);
  }
  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const body = { list: form.list, title: form.title, url: form.url, price_cents: toCents(form.price), for_whom: form.for_whom, notes: form.notes, status: form.status };
    try {
      if (form.id) await api(`/api/wishes/${form.id}`, { method: 'PATCH', body });
      else await api('/api/wishes', { method: 'POST', body });
      setDraft(null); reload(); changes.emit('wishes');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/wishes/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload();
  }

  const meta = LISTS.find((l) => l.value === list)!;
  const row = (w: Wish) => (
    <Card key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <Check on={w.status === 'done'} onPress={() => toggle(w)} />
      <Pressable style={{ flex: 1 }} onPress={() => setDraft({ id: w.id, list: w.list, title: w.title, url: w.url ?? '', price: w.price_cents != null ? String(w.price_cents / 100) : '', for_whom: w.for_whom ?? '', notes: w.notes ?? '', status: w.status })}>
        <Text style={[ui.rowTitle, w.status === 'done' && { color: C.faint, textDecorationLine: 'line-through' }]}>{w.title}</Text>
        <Text style={ui.rowSub}>{[w.for_whom ? `For ${w.for_whom}` : null, w.notes, `Added by ${memberName(w.added_by)}`].filter(Boolean).join(' · ')}</Text>
      </Pressable>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {w.price_cents != null ? <Text style={{ fontWeight: '700', color: C.ink }}>{money(w.price_cents)}</Text> : null}
        {w.url ? <Pressable hitSlop={10} onPress={() => Linking.openURL(w.url!)}><Icon name="open-in-new" size={18} color={C.accent} /></Pressable> : null}
      </View>
      <View style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 2, backgroundColor: memberColor(w.added_by) }} />
    </Card>
  );

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Wish lists" subtitle={total ? `${money(total)} across ${open.length} item${open.length === 1 ? '' : 's'}` : undefined} />
      <View style={{ paddingHorizontal: S.lg }}>
        <Chips value={list} onChange={setList} options={LISTS} />
      </View>
      <ErrorBar error={error} />
      {loading ? <Loading /> : (
        <FlatList
          data={[...open, ...done]}
          keyExtractor={(w) => w.id}
          contentContainerStyle={[ui.list, { gap: S.sm, paddingTop: S.md }]}
          ListEmptyComponent={<Empty icon="gift-outline" title={`No ${meta.label.toLowerCase()} yet`} text={meta.empty} />}
          renderItem={({ item, index }) => (
            <>
              {index === open.length && done.length ? <Text style={[ui.section, { marginTop: S.md, paddingHorizontal: S.xs }]}>{list === 'gift' ? 'Given' : 'Bought'}</Text> : null}
              {row(item)}
            </>
          )}
        />
      )}
      <Fab onPress={() => setDraft({ list, title: '', url: '', price: '', for_whom: '', notes: '', status: 'open' })} />
      <Sheet visible={!!draft} title={form.id ? 'Edit item' : 'New item'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Chips label="List" value={form.list} onChange={(v) => set('list', v)} options={LISTS} />
        <Field label="Item" value={form.title} onChangeText={(v) => set('title', v)} placeholder="e.g. Stand mixer" />
        <Field label="Price" value={form.price} onChangeText={(v) => set('price', v)} placeholder="Optional" keyboardType="decimal-pad" />
        {form.list === 'gift' ? <Field label="For" value={form.for_whom} onChangeText={(v) => set('for_whom', v)} placeholder="e.g. Mum, birthday in May" /> : null}
        <Field label="Link" value={form.url} onChangeText={(v) => set('url', v)} placeholder="Paste a product link" autoCapitalize="none" keyboardType="url" />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Size, colour, where to buy" multiline />
        {form.id && form.status !== 'done' ? <Button kind="ghost" icon="check" title={form.list === 'gift' ? 'Mark as given' : 'Mark as bought'} onPress={() => { set('status', 'done'); }} /> : null}
      </Sheet>
    </View>
  );
}
