import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, changes, type ShoppingItem } from '../../lib/api';
import { useList } from '../../lib/useList';
import { useSession } from '../../lib/session';
import { Check, Chips, Empty, ErrorBar, Field, Header, HeaderButton, Loading, Segmented, Sheet, styles as ui, tap, useForm } from '../../components/ui';
import { Pantry } from '../../components/Pantry';
import { AddBar, groupRowStyle } from '../../components/ListBits';
import { C, S } from '../../lib/theme';

const AISLES = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'Household', 'Other'];

export default function Shopping() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<'buy' | 'home'>(params.view === 'home' ? 'home' : 'buy');
  useEffect(() => { if (params.view === 'home' || params.view === 'buy') setView(params.view); }, [params.view]);
  const { memberColor } = useSession();
  const { data, setData, loading, error, reload } = useList<ShoppingItem>('/api/shopping_items', 'shopping_items');
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<ShoppingItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const open = data.filter((i) => !i.checked);
    const done = data.filter((i) => i.checked);
    const groups = AISLES.map((a) => ({ title: a, data: open.filter((i) => i.aisle === a) })).filter((g) => g.data.length);
    const known = new Set(AISLES);
    const other = open.filter((i) => !known.has(i.aisle));
    if (other.length) groups.push({ title: 'Other', data: other });
    if (done.length) groups.push({ title: `In the trolley (${done.length})`, data: done });
    return groups;
  }, [data]);

  async function add() {
    const name = text.trim();
    if (!name) return;
    setText('');
    // "Milk x2" or "Milk, 2L" sets a quantity.
    const m = name.match(/^(.*?)(?:\s*[,x×]\s*|\s+)(\d+\s*\w*)$/i);
    const body = m && m[1] ? { name: m[1], qty: m[2] } : { name };
    try {
      const row = await api<ShoppingItem>('/api/shopping_items', { method: 'POST', body });
      setData((d) => [...d, row]);
    } catch { setText(name); }
  }

  async function toggle(item: ShoppingItem) {
    const checked = item.checked ? 0 : 1;
    setData((d) => d.map((i) => (i.id === item.id ? { ...i, checked } : i)));
    api(`/api/shopping_items/${item.id}`, { method: 'PATCH', body: { checked } }).catch(reload);
  }

  async function doneShopping() {
    tap();
    const n = data.filter((i) => i.checked).length;
    setData((d) => d.filter((i) => !i.checked));
    try {
      await api('/api/shopping_items/clear-checked', { method: 'POST' });
      changes.emit('pantry_items');
      Alert.alert('Done shopping', `${n} item${n === 1 ? '' : 's'} moved to At home.`);
    } catch { reload(); }
  }

  const { form, set } = useForm({ name: edit?.name ?? '', qty: edit?.qty ?? '', aisle: edit?.aisle ?? 'Other', note: edit?.note ?? '' }, [edit]);
  async function save() {
    if (!edit) return;
    await api(`/api/shopping_items/${edit.id}`, { method: 'PATCH', body: form }).catch(() => undefined);
    setEdit(null); reload();
  }
  async function remove() {
    if (!edit) return;
    setData((d) => d.filter((i) => i.id !== edit.id));
    setEdit(null);
    await api(`/api/shopping_items/${edit.id}`, { method: 'DELETE' }).catch(reload);
  }

  const openCount = data.filter((i) => !i.checked).length;
  const hasChecked = data.some((i) => i.checked);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Shopping" subtitle={view === 'buy' ? `${openCount} to buy` : 'What we already have'}
        right={view === 'buy' && hasChecked ? <HeaderButton icon="cart-check" label="Done shopping" onPress={doneShopping} /> : null} />

      <View style={{ paddingHorizontal: S.lg, paddingBottom: S.md, gap: S.md }}>
        <Segmented value={view} onChange={setView} options={[{ value: 'buy', label: 'To buy' }, { value: 'home', label: 'At home' }]} />
        {view === 'buy' ? <AddBar value={text} onChange={setText} onSubmit={add} placeholder="Add an item, e.g. Milk 2L…" /> : null}
      </View>

      {view === 'home' ? <Pantry /> : (
        <>
          <ErrorBar error={error} />
          {loading ? <Loading /> : (
            <SectionList
              sections={sections}
              keyExtractor={(i) => i.id}
              contentContainerStyle={ui.list}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}
              ListEmptyComponent={<Empty icon="cart-outline" title="List is empty" text="Type above to add something, or add a recipe's missing ingredients from Meals." />}
              ListFooterComponent={hasChecked ? <Text style={[ui.rowSub, { textAlign: 'center', marginTop: S.lg }]}>Tap Done shopping to move ticked items into At home.</Text> : null}
              renderSectionHeader={({ section }) => <Text style={[ui.section, { fontSize: 14, color: C.sub, marginTop: S.lg, marginBottom: S.sm, paddingHorizontal: S.xs }]}>{section.title}</Text>}
              renderItem={({ item, index, section }) => (
                <View style={groupRowStyle(index, section.data.length)}>
                  {index ? <View style={ui.sep} /> : null}
                  <View style={ui.row}>
                    <Check on={!!item.checked} onPress={() => toggle(item)} label={item.name} />
                    <Pressable style={{ flex: 1 }} onPress={() => setEdit(item)}>
                      <Text style={[ui.rowTitle, !!item.checked && { color: C.faint, textDecorationLine: 'line-through' }]}>{item.name}</Text>
                      {item.qty || item.note ? <Text style={ui.rowSub}>{[item.qty, item.note ? `for ${item.note}` : null].filter(Boolean).join(' · ')}</Text> : null}
                    </Pressable>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: memberColor(item.added_by), opacity: item.checked ? 0.3 : 1 }} />
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}

      <Sheet visible={!!edit} title="Edit item" onClose={() => setEdit(null)} onSave={save} onDelete={remove}>
        <Field label="Item" value={form.name} onChangeText={(v) => set('name', v)} />
        <Field label="Quantity" value={form.qty ?? ''} onChangeText={(v) => set('qty', v)} placeholder="e.g. 2, 500g, 1 bunch" />
        <Field label="For" value={form.note ?? ''} onChangeText={(v) => set('note', v)} placeholder="Optional, e.g. Tacos" />
        <Chips label="Aisle" value={form.aisle} onChange={(v) => set('aisle', v)} options={AISLES.map((a) => ({ value: a, label: a }))} />
      </Sheet>
    </View>
  );
}
