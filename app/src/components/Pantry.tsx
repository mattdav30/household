import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { api, changes, type PantryItem } from '../lib/api';
import { useList } from '../lib/useList';
import { AddBar, groupRowStyle } from './ListBits';
import { Chips, Empty, ErrorBar, Field, Icon, Loading, Sheet, styles as ui, tap, useForm } from './ui';
import { C, S } from '../lib/theme';

export const LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Household'];
const ICONS = { Fridge: 'fridge-outline', Freezer: 'snowflake', Pantry: 'cupboard-outline', Household: 'spray-bottle' } as const;

/** The At home list: what we already have, by where it lives. */
export function Pantry() {
  const { data, setData, loading, error, reload } = useList<PantryItem>('/api/pantry_items', 'pantry_items');
  const [text, setText] = useState('');
  const [where, setWhere] = useState('Fridge');
  const [edit, setEdit] = useState<PantryItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const known = new Set(LOCATIONS);
    const groups = LOCATIONS.map((l) => ({ title: l, data: data.filter((i) => i.location === l) }));
    const other = data.filter((i) => !known.has(i.location));
    if (other.length) groups.push({ title: 'Other', data: other });
    return groups.filter((g) => g.data.length);
  }, [data]);

  async function add() {
    const name = text.trim();
    if (!name) return;
    setText('');
    const m = name.match(/^(.*?)(?:\s*[,x×]\s*|\s+)(\d+\s*\w*)$/i);
    const body = { ...(m && m[1] ? { name: m[1], qty: m[2] } : { name }), location: where };
    try {
      const row = await api<PantryItem>('/api/pantry_items', { method: 'POST', body });
      setData((d) => [...d, row]);
    } catch { setText(name); }
  }

  function usedUp(item: PantryItem) {
    tap();
    const go = async (add_to_list: boolean) => {
      setData((d) => d.filter((i) => i.id !== item.id));
      await api(`/api/pantry_items/${item.id}/used-up`, { method: 'POST', body: { add_to_list } }).catch(reload);
      if (add_to_list) changes.emit('shopping_items');
    };
    Alert.alert(`Out of ${item.name}?`, 'Add it to the shopping list as well?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Just remove', onPress: () => go(false) },
      { text: 'Add to list', onPress: () => go(true) },
    ]);
  }

  const { form, set } = useForm({ name: edit?.name ?? '', qty: edit?.qty ?? '', location: edit?.location ?? 'Pantry' }, [edit]);
  async function save() {
    if (!edit) return;
    await api(`/api/pantry_items/${edit.id}`, { method: 'PATCH', body: form }).catch(() => undefined);
    setEdit(null); reload();
  }
  async function remove() {
    if (!edit) return;
    setData((d) => d.filter((i) => i.id !== edit.id));
    setEdit(null);
    await api(`/api/pantry_items/${edit.id}`, { method: 'DELETE' }).catch(reload);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: S.lg, gap: S.sm, paddingBottom: S.sm }}>
        <AddBar value={text} onChange={setText} onSubmit={add} placeholder={`Add to ${where.toLowerCase()}, e.g. Eggs 12…`} />
        <Chips value={where} onChange={setWhere} options={LOCATIONS.map((l) => ({ value: l, label: l }))} />
      </View>
      <ErrorBar error={error} />
      {loading ? <Loading /> : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={ui.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}
          ListEmptyComponent={<Empty icon="fridge-outline" title="Nothing tracked yet" text="Add staples like olive oil, rice and spices once. Ticked shopping moves here when you tap Done shopping, and recipes check this list before adding to the shopping list." />}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: S.lg, marginBottom: S.sm, paddingHorizontal: S.xs }}>
              <Icon name={ICONS[section.title as keyof typeof ICONS] ?? 'shape-outline'} size={16} color={C.sub} />
              <Text style={[ui.section, { fontSize: 14, color: C.sub }]}>{section.title} · {section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View style={groupRowStyle(index, section.data.length)}>
              {index ? <View style={ui.sep} /> : null}
              <View style={ui.row}>
                <Pressable style={{ flex: 1 }} onPress={() => setEdit(item)}>
                  <Text style={ui.rowTitle}>{item.name}</Text>
                  {item.qty ? <Text style={ui.rowSub}>{item.qty}</Text> : null}
                </Pressable>
                <Pressable onPress={() => usedUp(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${item.name} used up`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.raised }}>
                  <Icon name="minus-circle-outline" size={16} color={C.sub} />
                  <Text style={{ color: C.sub, fontWeight: '700', fontSize: 13 }}>Used up</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
      <Sheet visible={!!edit} title="Edit item" onClose={() => setEdit(null)} onSave={save} onDelete={remove}>
        <Field label="Item" value={form.name} onChangeText={(v) => set('name', v)} />
        <Field label="Quantity" value={form.qty ?? ''} onChangeText={(v) => set('qty', v)} placeholder="Optional" />
        <Chips label="Kept in" value={form.location} onChange={(v) => set('location', v)} options={LOCATIONS.map((l) => ({ value: l, label: l }))} />
      </Sheet>
    </View>
  );
}
