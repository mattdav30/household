import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from 'react-native';
import { api, type ShoppingItem } from '../../lib/api';
import { useList } from '../../lib/useList';
import { useSession } from '../../lib/session';
import { Check, Chips, Empty, ErrorBar, Field, Header, Icon, Loading, Sheet, styles as ui, tap, useForm } from '../../components/ui';
import { C, R, S } from '../../lib/theme';

const AISLES = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'Household', 'Other'];

export default function Shopping() {
  const { memberColor } = useSession();
  const { data, setData, loading, error, reload } = useList<ShoppingItem>('/api/shopping_items', 'shopping_items');
  const [text, setText] = useState('');
  const [edit, setEdit] = useState<ShoppingItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const input = useRef<TextInput>(null);

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

  async function clearChecked() {
    tap();
    setData((d) => d.filter((i) => !i.checked));
    await api('/api/shopping_items/clear-checked', { method: 'POST' }).catch(reload);
  }

  const { form, set } = useForm({ name: edit?.name ?? '', qty: edit?.qty ?? '', aisle: edit?.aisle ?? 'Other' }, [edit]);
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

  const hasChecked = data.some((i) => i.checked);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Shopping" subtitle={`${data.filter((i) => !i.checked).length} to buy`} right={hasChecked ? (
        <Pressable onPress={clearChecked} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="broom" size={18} color={C.accent} />
          <Text style={{ color: C.accent, fontWeight: '600' }}>Clear ticked</Text>
        </Pressable>
      ) : null} />

      <View style={{ paddingHorizontal: S.lg, paddingBottom: S.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R.card, borderWidth: 1, borderColor: C.line, paddingLeft: S.md }}>
          <Icon name="plus" color={C.sub} />
          <TextInput ref={input} value={text} onChangeText={setText} onSubmitEditing={add} submitBehavior="submit"
            placeholder="Add an item, e.g. Milk 2L" placeholderTextColor={C.faint} returnKeyType="done"
            style={{ flex: 1, fontSize: 16, paddingVertical: 14, paddingHorizontal: S.sm, color: C.ink }} />
          {text ? <Pressable onPress={add} style={{ padding: S.md }}><Text style={{ color: C.accent, fontWeight: '700' }}>Add</Text></Pressable> : null}
        </View>
      </View>
      <ErrorBar error={error} />

      {loading ? <Loading /> : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={ui.list}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} />}
          ListEmptyComponent={<Empty icon="cart-outline" title="List is empty" text="Type above to add something. Both phones update straight away." />}
          renderSectionHeader={({ section }) => <Text style={[ui.section, { marginTop: S.lg, marginBottom: S.sm, paddingHorizontal: S.xs }]}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <View style={{
              backgroundColor: C.card, paddingHorizontal: S.lg,
              borderTopLeftRadius: index === 0 ? R.card : 0, borderTopRightRadius: index === 0 ? R.card : 0,
              borderBottomLeftRadius: index === section.data.length - 1 ? R.card : 0, borderBottomRightRadius: index === section.data.length - 1 ? R.card : 0,
            }}>
              {index ? <View style={ui.sep} /> : null}
              <View style={ui.row}>
                <Check on={!!item.checked} onPress={() => toggle(item)} />
                <Pressable style={{ flex: 1 }} onPress={() => setEdit(item)}>
                  <Text style={[ui.rowTitle, !!item.checked && { color: C.faint, textDecorationLine: 'line-through' }]}>{item.name}</Text>
                  {item.qty ? <Text style={ui.rowSub}>{item.qty}</Text> : null}
                </Pressable>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: memberColor(item.added_by), opacity: item.checked ? 0.3 : 1 }} />
              </View>
            </View>
          )}
        />
      )}

      <Sheet visible={!!edit} title="Edit item" onClose={() => setEdit(null)} onSave={save} onDelete={remove}>
        <Field label="Item" value={form.name} onChangeText={(v) => set('name', v)} />
        <Field label="Quantity" value={form.qty ?? ''} onChangeText={(v) => set('qty', v)} placeholder="e.g. 2, 500g, 1 bunch" />
        <Chips label="Aisle" value={form.aisle} onChange={(v) => set('aisle', v)} options={AISLES.map((a) => ({ value: a, label: a }))} />
      </Sheet>
    </View>
  );
}

