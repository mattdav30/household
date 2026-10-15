// Build or edit one of your own workouts: name it, pick exercises, set the sets, reps, weight or time.
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, changes } from '../lib/api';
import { C, S } from '../lib/theme';
import type { Move } from '../lib/lifts';
import type { PlanItem, Template } from '../lib/strength';
import { MovePicker } from '../components/MovePicker';
import { Button, Field, Icon, styles as ui, tap } from '../components/ui';

export default function TemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [items, setItems] = useState<PlanItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    api<Template[]>('/api/fit/templates').then((all) => {
      const t = all.find((x) => x.id === id);
      if (t) { setName(t.name); setItems(t.items); }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [id]);

  const add = (moves: Move[]) => setItems((xs) => [...xs, ...moves.map((m): PlanItem => ({
    move_id: m.id, move_name: m.name, track: m.track, sets: m.track === 'cardio' ? 1 : 3,
    reps: m.track === 'weight' || m.track === 'reps' ? 10 : null, weight_kg: null, seconds: m.track === 'time' ? 30 : m.track === 'cardio' ? 20 : null,
  }))]);
  const edit = (i: number, patch: Partial<PlanItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const out = [...xs];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });

  const save = async (start: boolean) => {
    if (!name.trim()) { Alert.alert('Give it a name', 'Something like Push day or Legs and core.'); return; }
    if (!items.length) { Alert.alert('Add an exercise first'); return; }
    setBusy(true);
    try {
      let tid = id;
      if (id) await api(`/api/fit/templates/${id}`, { method: 'PATCH', body: { name, items } });
      else tid = (await api<{ id: string }>('/api/fit/templates', { method: 'POST', body: { name, items } })).id;
      changes.emit('templates');
      if (start) router.replace({ pathname: '/lift', params: { template: tid } });
      else router.back();
    } catch (e) { Alert.alert('That did not save', (e as Error).message); } finally { setBusy(false); }
  };
  const remove = () => Alert.alert(`Delete ${name || 'this workout'}?`, 'Past sessions and personal bests stay.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api(`/api/fit/templates/${id}`, { method: 'DELETE' }).catch(() => undefined); changes.emit('templates'); router.back(); } },
  ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + 40, gap: S.md }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
            <Icon name="arrow-left" color={C.sub} />
          </Pressable>
          <Text style={[ui.h1, { flex: 1 }]}>{id ? 'Edit workout' : 'New workout'}</Text>
        </View>
        {!loaded ? <Text style={{ color: C.sub }}>Loading…</Text> : (
          <>
            <Field label="Name" value={name} onChangeText={setName} placeholder="Push day" maxLength={60} />
            {items.map((it, i) => (
              <View key={`${it.move_id}${i}`} style={[ui.card, { gap: S.sm }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                  <Text style={[ui.rowTitle, { flex: 1 }]} numberOfLines={2}>{it.move_name}</Text>
                  <IconBtn icon="arrow-up" label="Move up" onPress={() => move(i, -1)} />
                  <IconBtn icon="arrow-down" label="Move down" onPress={() => move(i, 1)} />
                  <IconBtn icon="trash-can-outline" label="Remove" onPress={() => setItems((xs) => xs.filter((_, j) => j !== i))} />
                </View>
                <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
                  <Num label="Sets" value={it.sets} onChange={(v) => edit(i, { sets: Math.max(1, Math.min(20, Math.round(v ?? 1))) })} />
                  {it.track === 'weight' || it.track === 'reps' ? <Num label="Reps" value={it.reps} onChange={(v) => edit(i, { reps: v })} /> : null}
                  {it.track === 'weight' ? <Num label="Kg" value={it.weight_kg} onChange={(v) => edit(i, { weight_kg: v })} decimal /> : null}
                  {it.track === 'time' ? <Num label="Seconds" value={it.seconds} onChange={(v) => edit(i, { seconds: v })} /> : null}
                  {it.track === 'cardio' ? <Num label="Minutes" value={it.seconds} onChange={(v) => edit(i, { seconds: v })} /> : null}
                </View>
              </View>
            ))}
            <Button title="Add exercises" icon="plus" kind="soft" onPress={() => { tap(); setPicking(true); }} />
            <View style={{ height: S.sm }} />
            <Button title="Save and start" icon="play" onPress={() => save(true)} busy={busy} />
            <Button title="Save" kind="ghost" onPress={() => save(false)} />
            {id ? <Button title="Delete workout" kind="danger" icon="trash-can-outline" onPress={remove} /> : null}
          </>
        )}
      </ScrollView>
      <MovePicker visible={picking} onClose={() => setPicking(false)} onPick={add} />
    </KeyboardAvoidingView>
  );
}

function IconBtn({ icon, label, onPress }: { icon: 'arrow-up' | 'arrow-down' | 'trash-can-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 10, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={18} color={icon === 'trash-can-outline' ? C.danger : C.sub} />
    </Pressable>
  );
}

function Num({ label, value, onChange, decimal }: { label: string; value: number | null; onChange: (v: number | null) => void; decimal?: boolean }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  return (
    <View style={{ width: 84, gap: 4 }}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <TextInput value={text} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} accessibilityLabel={label}
        onChangeText={(t) => { setText(t); const v = Number(t.replace(',', '.')); onChange(t.trim() && isFinite(v) && v > 0 ? v : null); }}
        style={{ backgroundColor: C.raised, color: C.ink, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, fontWeight: '700' }} />
    </View>
  );
}
