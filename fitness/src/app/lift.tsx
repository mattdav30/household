// Logging a workout of your own: tick off each set with its weight and reps, or time, with a rest timer between.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { api, changes, type Summary } from '../lib/api';
import { useStore } from '../lib/store';
import { local } from '../lib/local';
import { C, S, tint } from '../lib/theme';
import { fmtTime } from '../lib/gps';
import type { Move, Track } from '../lib/lifts';
import {
  exerciseFrom, keyOf, loadLift, pbText, planFrom, saveLift, sessionFrom, setText, setValues,
  type LastSet, type LiftSession, type LogSet, type Pb, type Template,
} from '../lib/strength';
import { MovePicker } from '../components/MovePicker';
import { HowToButton } from '../components/MoveDemo';
import { Button, Icon, IconBadge, styles as ui, tap } from '../components/ui';

const COLS: Record<Track, { a?: string; b?: string }> = {
  weight: { a: 'kg', b: 'reps' }, reps: { b: 'reps' }, time: { b: 'secs' }, cardio: { a: 'km', b: 'min' },
};

export default function LiftScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { apply } = useStore();
  const { template } = useLocalSearchParams<{ template?: string }>();
  const [s, setS] = useState<LiftSession | null>(() => loadLift());
  const [last, setLast] = useState<Record<string, LastSet[]>>({});
  const [picking, setPicking] = useState(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [result, setResult] = useState<null | { pbs: Pb[]; minutes: number; sets: number; volume: number; summary: Summary }>(null);
  const [busy, setBusy] = useState(false);
  const [savedPlan, setSavedPlan] = useState(false);

  // Start from a saved workout, or an empty one, unless one is already going.
  useEffect(() => {
    if (s) return;
    if (!template) { const fresh = sessionFrom(null); setS(fresh); saveLift(fresh); setPicking(true); return; }
    api<Template[]>('/api/fit/templates').then((all) => {
      const fresh = sessionFrom(all.find((t) => t.id === template) ?? null);
      setS(fresh); saveLift(fresh);
    }).catch(() => { const fresh = sessionFrom(null); setS(fresh); saveLift(fresh); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn: (x: LiftSession) => LiftSession) => setS((x) => { if (!x) return x; const y = fn(x); saveLift(y); return y; }), []);

  // Your last time on each exercise, shown beside each set.
  const moveIds = s?.exercises.map((e) => e.move.id).join(',') ?? '';
  useEffect(() => {
    if (!moveIds) return;
    api<Record<string, LastSet[]>>(`/api/fit/last-sets?moves=${encodeURIComponent(moveIds)}`).then(setLast).catch(() => undefined);
  }, [moveIds]);

  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { activateKeepAwakeAsync('lift').catch(() => undefined); return () => { deactivateKeepAwake('lift'); }; }, []);
  const restLeft = restUntil ? Math.ceil((restUntil - Date.now()) / 1000) : 0;
  const restDone = useRef(false);
  useEffect(() => {
    if (!restUntil) { restDone.current = false; return; }
    if (restLeft <= 0 && !restDone.current) {
      restDone.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      if (local.voice()) Speech.speak('Rest over. Next set.', { language: 'en-AU' });
      setTimeout(() => setRestUntil(null), 1500);
    }
  });

  if (result) return <Result r={result} canSavePlan={!s?.templateId && !savedPlan} onSavePlan={async () => {
    if (!s) return;
    try { await api('/api/fit/templates', { method: 'POST', body: { name: s.name, items: planFrom(s) } }); changes.emit('templates'); setSavedPlan(true); Alert.alert('Saved', `${s.name} is in your workouts now.`); }
    catch (e) { Alert.alert('That did not save', (e as Error).message); }
  }} onDone={() => { saveLift(null); router.back(); }} />;
  if (!s) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const setSet = (ei: number, si: number, patch: Partial<LogSet>) => update((x) => ({
    ...x, exercises: x.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j === si ? { ...st, ...patch } : st)) })),
  }));
  const tick = (ei: number, si: number) => {
    const e = s.exercises[ei];
    const st = e.sets[si];
    if (!st.done) {
      // Fill an empty set from the one before, or from last time, so a tick is all it takes.
      const prevSet = e.sets[si - 1];
      const lastSet = last[e.move.id]?.[si] ?? last[e.move.id]?.[last[e.move.id].length - 1];
      const fill: Partial<LogSet> = {};
      if (!st.weight && e.move.track === 'weight') fill.weight = prevSet?.weight || (lastSet?.weight_kg != null ? String(lastSet.weight_kg) : '');
      if (!st.reps && (e.move.track === 'weight' || e.move.track === 'reps')) fill.reps = prevSet?.reps || (lastSet?.reps != null ? String(lastSet.reps) : '');
      if (!st.secs && e.move.track === 'time') fill.secs = prevSet?.secs || (lastSet?.seconds != null ? String(lastSet.seconds) : '');
      const merged = { ...st, ...fill };
      if (!setValues(e.move.track, merged)) { Alert.alert('Add the numbers first', e.move.track === 'time' ? 'How many seconds?' : e.move.track === 'cardio' ? 'Minutes or distance.' : 'How many reps?'); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      setSet(ei, si, { ...fill, done: true });
      if (e.move.track !== 'cardio') setRestUntil(Date.now() + (e.move.track === 'time' ? 30 : s.restSecs) * 1000);
    } else setSet(ei, si, { done: false });
  };
  const addSet = (ei: number) => update((x) => ({
    ...x, exercises: x.exercises.map((e, i) => { if (i !== ei) return e; const p = e.sets[e.sets.length - 1]; return { ...e, sets: [...e.sets, { weight: p?.weight ?? '', reps: p?.reps ?? '', secs: p?.secs ?? '', km: '', done: false }] }; }),
  }));
  const removeSet = (ei: number, si: number) => update((x) => ({ ...x, exercises: x.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })) }));
  const exerciseMenu = (ei: number) => {
    const e = s.exercises[ei];
    Alert.alert(e.move.name, undefined, [
      { text: 'Move up', onPress: () => update((x) => { if (ei === 0) return x; const ex = [...x.exercises]; [ex[ei - 1], ex[ei]] = [ex[ei], ex[ei - 1]]; return { ...x, exercises: ex }; }) },
      { text: 'Remove', style: 'destructive', onPress: () => update((x) => ({ ...x, exercises: x.exercises.filter((_, i) => i !== ei) })) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doneSets = s.exercises.flatMap((e, ord) => e.sets.map((st, si) => ({ e, st, ord, si }))).filter((x) => x.st.done && setValues(x.e.move.track, x.st));
  const finish = () => {
    if (!doneSets.length) {
      Alert.alert('No sets ticked yet', 'Tick each set as you finish it.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard workout', style: 'destructive', onPress: () => { saveLift(null); router.back(); } },
      ]);
      return;
    }
    Alert.alert('Finish workout?', `${doneSets.length} ${doneSets.length === 1 ? 'set' : 'sets'} done in ${fmtTime(Date.now() - s.startedAt)}.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Finish', onPress: save },
    ]);
  };
  const save = async () => {
    setBusy(true);
    try {
      const minutes = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
      const sets = doneSets.map((x) => ({ move_id: x.e.move.id, move_name: x.e.move.name, track: x.e.move.track, ord: x.ord, set_no: x.si + 1, ...setValues(x.e.move.track, x.st)! }));
      const r = await api<{ pbs: Pb[]; summary: Summary }>('/api/fit/workouts', { method: 'POST', body: { minutes, kind: 'gym', title: s.name, effort: 2, sets } });
      apply(r.summary);
      changes.emit('workouts');
      const volume = sets.reduce((a, x) => a + (x.weight_kg && x.reps ? x.weight_kg * x.reps : 0), 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setRestUntil(null);
      setResult({ pbs: r.pbs ?? [], minutes, sets: sets.length, volume, summary: r.summary });
    } catch (e) { Alert.alert('That did not save', `${(e as Error).message} Your workout is kept on this phone, so try again in a moment.`); }
    finally { setBusy(false); }
  };
  const cancel = () => Alert.alert('Cancel this workout?', 'Nothing gets logged.', [
    { text: 'Keep going', style: 'cancel' },
    { text: 'Cancel workout', style: 'destructive', onPress: () => { saveLift(null); router.back(); } },
  ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.lg, paddingBottom: S.sm, flexDirection: 'row', alignItems: 'center', gap: S.md, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flex: 1 }}>
          <TextInput value={s.name} onChangeText={(t) => update((x) => ({ ...x, name: t }))} style={[ui.h2, { padding: 0 }]} accessibilityLabel="Workout name" maxLength={60} />
          <Text style={[ui.rowSub, ui.num]}>{fmtTime(Date.now() - s.startedAt)} · {doneSets.length} sets done</Text>
        </View>
        <Pressable onPress={finish} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: C.green, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, opacity: pressed || busy ? 0.7 : 1 })}>
          <Text style={{ color: '#0d1a12', fontWeight: '800' }}>{busy ? 'Saving…' : 'Finish'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: insets.bottom + 140 }} keyboardShouldPersistTaps="handled">
        {s.exercises.map((e, ei) => {
          const cols = COLS[e.move.track];
          const prev = last[e.move.id] ?? [];
          return (
            <View key={e.key} style={[ui.card, { gap: S.sm, padding: S.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.rowTitle, { color: C.accent }]}>{e.move.name}</Text>
                  <Text style={ui.rowSub}>{e.move.equip} · {e.move.group}</Text>
                </View>
                <HowToButton moveId={e.move.id} name={e.move.name} compact />
                <Pressable onPress={() => exerciseMenu(ei)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Options for ${e.move.name}`}>
                  <Icon name="dots-horizontal" size={22} color={C.sub} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[hd, { width: 30 }]}>SET</Text>
                <Text style={[hd, { flex: 1 }]}>LAST TIME</Text>
                {cols.a ? <Text style={[hd, { width: 64, textAlign: 'center' }]}>{cols.a.toUpperCase()}</Text> : null}
                <Text style={[hd, { width: 64, textAlign: 'center' }]}>{cols.b?.toUpperCase()}</Text>
                <View style={{ width: 40 }} />
              </View>
              {e.sets.map((st, si) => {
                const p = prev[si];
                return (
                  <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: st.done ? tint(C.green, 0.12) : 'transparent', borderRadius: 10, paddingVertical: 3 }}>
                    <Pressable onLongPress={() => Alert.alert(`Remove set ${si + 1}?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeSet(ei, si) }])}
                      style={{ width: 30, alignItems: 'center' }} accessibilityLabel={`Set ${si + 1}. Hold to remove.`}>
                      <Text style={{ color: C.ink, fontWeight: '800' }}>{si + 1}</Text>
                    </Pressable>
                    <Text style={[{ flex: 1, color: C.faint, fontSize: 13 }, ui.num]} numberOfLines={1}>{p ? setText(e.move.track, p) : '–'}</Text>
                    {e.move.track === 'weight' ? <Cell value={st.weight} placeholder={p?.weight_kg != null ? String(p.weight_kg) : 'kg'} decimal onChange={(v) => setSet(ei, si, { weight: v })} label={`Set ${si + 1} kilograms`} /> : null}
                    {e.move.track === 'cardio' ? <Cell value={st.km} placeholder="km" decimal onChange={(v) => setSet(ei, si, { km: v })} label={`Set ${si + 1} kilometres`} /> : null}
                    {e.move.track === 'weight' || e.move.track === 'reps' ? <Cell value={st.reps} placeholder={p?.reps != null ? String(p.reps) : 'reps'} onChange={(v) => setSet(ei, si, { reps: v })} label={`Set ${si + 1} reps`} /> : null}
                    {e.move.track === 'time' ? <Cell value={st.secs} placeholder={p?.seconds != null ? String(p.seconds) : 'secs'} onChange={(v) => setSet(ei, si, { secs: v })} label={`Set ${si + 1} seconds`} /> : null}
                    {e.move.track === 'cardio' ? <Cell value={st.secs} placeholder="min" decimal onChange={(v) => setSet(ei, si, { secs: v })} label={`Set ${si + 1} minutes`} /> : null}
                    <Pressable onPress={() => tick(ei, si)} accessibilityRole="checkbox" accessibilityState={{ checked: st.done }} accessibilityLabel={`Set ${si + 1} done`}
                      style={{ width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? C.green : C.raised }}>
                      <Icon name="check" size={20} color={st.done ? '#0d1a12' : C.faint} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable onPress={() => { tap(); addSet(ei); }} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}>
                <Text style={{ color: C.accent, fontWeight: '700' }}>+ Add set</Text>
              </Pressable>
            </View>
          );
        })}
        <Button title="Add exercises" icon="plus" kind="soft" onPress={() => { tap(); setPicking(true); }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm }}>
          <Text style={{ color: C.sub }}>Rest between sets</Text>
          {[60, 90, 120, 180].map((r) => (
            <Pressable key={r} onPress={() => update((x) => ({ ...x, restSecs: r }))} style={[ui.chip, { paddingHorizontal: 10, backgroundColor: s.restSecs === r ? C.accentSoft : C.raised, borderColor: s.restSecs === r ? C.accent : C.line }]}>
              <Text style={[ui.chipText, s.restSecs === r && { color: C.accent, fontWeight: '700' }]}>{r < 120 ? `${r}s` : `${r / 60}m`}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={cancel} accessibilityRole="button" style={{ alignSelf: 'center', padding: S.md }}>
          <Text style={{ color: C.danger, fontWeight: '700' }}>Cancel workout</Text>
        </Pressable>
      </ScrollView>

      {restUntil ? (
        <View style={{ position: 'absolute', left: S.lg, right: S.lg, bottom: insets.bottom + S.lg, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.accent, padding: S.md, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <Icon name="timer-sand" size={24} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{restLeft > 0 ? 'REST' : 'GO'}</Text>
            <Text style={[{ color: C.ink, fontSize: 24, fontWeight: '800' }, ui.num]}>{restLeft > 0 ? fmtTime(restLeft * 1000) : 'Next set'}</Text>
          </View>
          <Pressable onPress={() => setRestUntil((r) => (r ? r - 15000 : r))} style={restBtn} accessibilityLabel="Fifteen seconds less"><Text style={restTxt}>−15</Text></Pressable>
          <Pressable onPress={() => setRestUntil((r) => (r ? r + 15000 : r))} style={restBtn} accessibilityLabel="Fifteen seconds more"><Text style={restTxt}>+15</Text></Pressable>
          <Pressable onPress={() => setRestUntil(null)} style={restBtn} accessibilityLabel="Skip rest"><Text style={restTxt}>Skip</Text></Pressable>
        </View>
      ) : null}

      <MovePicker visible={picking} onClose={() => setPicking(false)}
        onPick={(moves: Move[]) => update((x) => ({ ...x, exercises: [...x.exercises, ...moves.map((m) => ({ ...exerciseFrom(m), key: keyOf() }))] }))} />
    </KeyboardAvoidingView>
  );
}

const hd = { color: C.faint, fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.5 };
const restBtn = { backgroundColor: C.raised, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 };
const restTxt = { color: C.ink, fontWeight: '800' as const };

function Cell({ value, placeholder, onChange, decimal, label }: { value: string; placeholder: string; onChange: (v: string) => void; decimal?: boolean; label: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.faint} keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      accessibilityLabel={label} selectTextOnFocus
      style={{ width: 64, height: 36, backgroundColor: C.raised, borderRadius: 10, color: C.ink, textAlign: 'center', fontSize: 16, fontWeight: '700', padding: 0 }} />
  );
}

function Result({ r, canSavePlan, onSavePlan, onDone }: { r: { pbs: Pb[]; minutes: number; sets: number; volume: number; summary: Summary }; canSavePlan: boolean; onSavePlan: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + 50, paddingBottom: insets.bottom + S.lg, gap: S.md }}>
      <View style={{ alignItems: 'center', gap: S.sm }}>
        <IconBadge name={r.pbs.length ? 'trophy' : 'arm-flex'} color={C.gold} size={84} />
        <Text style={[ui.h1, { textAlign: 'center' }]}>{r.pbs.length ? `${r.pbs.length} new ${r.pbs.length === 1 ? 'PB' : 'PBs'}!` : 'Workout done'}</Text>
        <Text style={[ui.headerSub, { textAlign: 'center' }]}>{r.minutes} min · {r.sets} sets{r.volume ? ` · ${Math.round(r.volume).toLocaleString()} kg lifted` : ''}</Text>
      </View>
      {r.pbs.map((p, i) => (
        <View key={i} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, borderColor: tint(C.gold, 0.5) }]}>
          <Icon name="medal" size={26} color={C.gold} />
          <View style={{ flex: 1 }}>
            <Text style={ui.rowTitle}>{p.move_name}</Text>
            <Text style={ui.rowSub}>{pbText(p)}</Text>
          </View>
        </View>
      ))}
      <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md }]}>
        <Icon name="paw" size={24} color={C.warm} />
        <Text style={{ color: C.ink, flex: 1 }}>{r.summary.pet.name ?? 'Your dog'} got {r.minutes} minutes in the bowl.</Text>
      </View>
      {canSavePlan ? <Button title="Save as one of my workouts" icon="content-save-outline" kind="soft" onPress={onSavePlan} /> : null}
      <Button title="Done" onPress={onDone} />
    </ScrollView>
  );
}
