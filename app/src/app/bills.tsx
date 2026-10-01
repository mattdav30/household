import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { api, changes, type Bill } from '../lib/api';
import { useList } from '../lib/useList';
import { BackHeader } from '../components/BackHeader';
import { Button, Card, Chips, DateField, Empty, ErrorBar, Fab, Field, Loading, Pill, Sheet, styles as ui, useForm } from '../components/ui';
import { REPEATS, daysUntil, friendly, money, repeatLabel, toCents, today } from '../lib/dates';
import { C, S } from '../lib/theme';

type Draft = { id?: string; name: string; amount: string; due_date: string; repeat: string; notes: string };
const blank = (): Draft => ({ name: '', amount: '', due_date: today(), repeat: 'monthly', notes: '' });

// Rough monthly cost of each repeat so the header shows a monthly total.
const PER_MONTH: Record<string, number> = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

export default function Bills() {
  const { data, loading, error, reload } = useList<Bill>('/api/bills', 'bills');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const { form, set } = useForm<Draft>(draft ?? blank(), [draft]);

  const monthly = Math.round(data.reduce((s, b) => s + (b.amount_cents ?? 0) * (PER_MONTH[b.repeat] ?? 0), 0));

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const body = { name: form.name, amount_cents: toCents(form.amount), due_date: form.due_date, repeat: form.repeat, notes: form.notes };
    try {
      if (form.id) await api(`/api/bills/${form.id}`, { method: 'PATCH', body });
      else await api('/api/bills', { method: 'POST', body });
      setDraft(null); reload(); changes.emit('bills');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!form.id) return;
    await api(`/api/bills/${form.id}`, { method: 'DELETE' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('bills');
  }
  async function paid(b: Bill) {
    await api(`/api/bills/${b.id}/paid`, { method: 'POST' }).catch(() => undefined);
    setDraft(null); reload(); changes.emit('bills');
  }
  const UNIT: Record<string, string> = { weekly: 'week', fortnightly: 'fortnight', monthly: 'month', quarterly: 'quarter', yearly: 'year' };
  const confirmPaid = (b: Bill) => Alert.alert(`Mark ${b.name} as paid?`,
    UNIT[b.repeat] ? `The next due date moves forward one ${UNIT[b.repeat]}.` : 'This one off bill comes off the list.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Paid', onPress: () => paid(b) }]);

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Bills" subtitle={monthly ? `About ${money(monthly)} a month in regular bills` : undefined} />
      <ErrorBar error={error} />
      {loading ? <Loading /> : (
        <FlatList
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[ui.list, { gap: S.sm }]}
          ListEmptyComponent={<Empty icon="receipt-text-outline" title="No bills yet" text="Add rent, power, phone, rego and subscriptions with their due dates. Both of you get a heads up three days out." />}
          renderItem={({ item }) => {
            const d = daysUntil(item.due_date);
            const status = d < 0 ? { label: 'Overdue', color: C.warm, bg: C.warmSoft }
              : d <= 3 ? { label: d === 0 ? 'Due today' : `${d} day${d > 1 ? 's' : ''}`, color: C.accent, bg: C.accentSoft } : null;
            return (
              <Pressable onPress={() => setDraft({ id: item.id, name: item.name, amount: item.amount_cents != null ? String(item.amount_cents / 100) : '', due_date: item.due_date, repeat: item.repeat, notes: item.notes ?? '' })}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={ui.rowTitle}>{item.name}</Text>
                    <Text style={ui.rowSub}>{friendly(item.due_date)} · {repeatLabel(item.repeat)}</Text>
                    {status ? <Pill {...status} /> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: C.ink }}>{money(item.amount_cents)}</Text>
                    <Pressable onPress={() => confirmPaid(item)} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.accent }}>
                      <Text style={{ color: C.accent, fontWeight: '600', fontSize: 13 }}>Paid</Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      <Fab onPress={() => setDraft(blank())} />
      <Sheet visible={!!draft} title={form.id ? 'Edit bill' : 'New bill'} onClose={() => setDraft(null)} onSave={save} saving={saving} onDelete={form.id ? remove : undefined}>
        <Field label="Bill" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Electricity" />
        <Field label="Amount" value={form.amount} onChangeText={(v) => set('amount', v)} placeholder="$0.00" keyboardType="decimal-pad" />
        <DateField label="Next due" value={form.due_date} onChange={(v) => v && set('due_date', v)} />
        <Chips label="Repeats" value={form.repeat} onChange={(v) => set('repeat', v)} options={REPEATS.filter((r) => r !== 'daily').map((r) => ({ value: r, label: repeatLabel(r) }))} />
        <Field label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="Account number, how to pay, etc." multiline />
        {form.id ? <Button kind="ghost" icon="check-circle-outline" title="Mark as paid" onPress={() => { const b = data.find((x) => x.id === form.id); if (b) confirmPaid(b); }} /> : null}
      </Sheet>
    </View>
  );
}
