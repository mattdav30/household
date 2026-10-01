import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { api, changes, type CheckedIngredient, type Ingredient } from '../lib/api';
import { Check, Pill, Sheet, styles as ui } from './ui';
import { C, S } from '../lib/theme';

type Item = Ingredient & { from?: string[] };

/**
 * Shows each ingredient as Have, On the list, or Need, with ticks on the ones to buy.
 * Adds the ticked ones to the shopping list.
 */
export function ShopSheet({ visible, items, note, onClose }: { visible: boolean; items: Item[]; note: string; onClose: () => void }) {
  const [rows, setRows] = useState<(CheckedIngredient & { from?: string[] })[] | null>(null);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRows(null);
    api<CheckedIngredient[]>('/api/ingredients/check', { method: 'POST', body: { items: items.map(({ name, qty }) => ({ name, qty })) } })
      .then((r) => {
        const merged = r.map((x, i) => ({ ...x, from: items[i]?.from }));
        setRows(merged);
        setPick(new Set(merged.map((x, i) => (x.status === 'need' ? i : -1)).filter((i) => i >= 0)));
      })
      .catch((e) => { Alert.alert('Could not check ingredients', (e as Error).message); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = (i: number) => setPick((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  async function add() {
    if (!rows) return;
    setBusy(true);
    try {
      const chosen = rows.filter((_, i) => pick.has(i)).map((r) => ({ name: r.name, qty: r.qty, note: r.from?.join(', ') || note }));
      const res = await api<{ added: number }>('/api/shopping_items/bulk', { method: 'POST', body: { items: chosen } });
      changes.emit('shopping_items');
      onClose();
      Alert.alert('Shopping list', res.added ? `Added ${res.added} item${res.added === 1 ? '' : 's'}.` : 'Everything ticked sits on the list already.');
    } catch (e) {
      Alert.alert('Could not add', (e as Error).message);
    } finally { setBusy(false); }
  }

  const counts = rows ? { have: rows.filter((r) => r.status === 'have').length, listed: rows.filter((r) => r.status === 'listed').length } : null;

  return (
    <Sheet visible={visible} title="Add to shopping" onClose={onClose} onSave={rows ? add : undefined} saving={busy}
      saveLabel={pick.size ? `Add ${pick.size} to shopping list` : 'Nothing ticked'}>
      {!rows ? <ActivityIndicator color={C.accent} style={{ marginVertical: 40 }} /> : (
        <>
          <Text style={ui.rowSub}>
            {counts!.have ? `${counts!.have} already at home. ` : ''}{counts!.listed ? `${counts!.listed} on the list already. ` : ''}Tick what to buy.
          </Text>
          <View>
            {rows.map((r, i) => (
              <Pressable key={i} onPress={() => toggle(i)} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                <Check on={pick.has(i)} onPress={() => toggle(i)} />
                <View style={{ flex: 1 }}>
                  <Text style={[ui.rowTitle, r.status !== 'need' && !pick.has(i) && { color: C.sub }]}>{r.name}</Text>
                  {r.qty || r.from?.length ? <Text style={ui.rowSub}>{[r.qty, r.from?.length ? r.from.join(', ') : null].filter(Boolean).join(' · ')}</Text> : null}
                </View>
                {r.status === 'have' ? <Pill label={r.location ? `In ${r.location.toLowerCase()}` : 'At home'} color={C.accent} bg={C.accentSoft} /> : null}
                {r.status === 'listed' ? <Pill label="On list" /> : null}
              </Pressable>
            ))}
          </View>
          <Text style={[ui.rowSub, { marginTop: -S.sm }]}>Items marked At home come from your At home list in Shopping.</Text>
        </>
      )}
    </Sheet>
  );
}
