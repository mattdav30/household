// Personal bests for every exercise you have logged, and the history of each one.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { api, changes } from '../lib/api';
import { useStore } from '../lib/store';
import { C, S } from '../lib/theme';
import { friendly } from '../lib/dates';
import { e1rm, fmtKg, type Track } from '../lib/lifts';
import { setText, type LiftSession2, type LiftSummary } from '../lib/strength';
import { Card, Empty, Icon, Loading, Segmented, styles as ui, tap } from '../components/ui';

/** The headline best for an exercise, in the way that suits it. */
function best(l: LiftSummary) {
  switch (l.track) {
    case 'weight': return l.best_weight != null ? `${fmtKg(l.best_weight)} kg` : l.best_reps != null ? `${l.best_reps} reps` : '–';
    case 'reps': return l.best_reps != null ? `${l.best_reps} reps` : '–';
    case 'time': return l.best_seconds != null ? setText('time', { weight_kg: null, reps: null, seconds: l.best_seconds, distance_m: null }) : '–';
    case 'cardio': return l.best_distance != null ? `${(l.best_distance / 1000).toFixed(2)} km` : l.best_seconds != null ? `${Math.round(l.best_seconds / 60)} min` : '–';
  }
}

export default function Lifts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, partner, name } = useStore();
  const { move, user } = useLocalSearchParams<{ move?: string; user?: string }>();
  const [who, setWho] = useState<string>(user ?? summary?.me ?? '');
  const [rows, setRows] = useState<LiftSummary[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const load = () => api<LiftSummary[]>(`/api/fit/lifts?user=${who}`).then(setRows).catch(() => setRows([]));
    setRows(null);
    load();
    return changes.on(load);
  }, [who]);

  const shown = useMemo(() => (rows ?? []).filter((r) => r.move_name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const open = move ? rows?.find((r) => r.move_id === move) : null;
  if (move) return <Detail lift={open ?? null} moveId={move} who={who} onBack={() => router.back()} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + 40, gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="arrow-left" color={C.sub} />
        </Pressable>
        <Text style={[ui.h1, { flex: 1 }]}>Personal bests</Text>
      </View>
      {partner && summary ? <Segmented value={who} onChange={setWho} options={[{ value: summary.me, label: name(summary.me) }, { value: partner.id, label: partner.name }]} /> : null}
      {rows && rows.length > 6 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.raised, borderRadius: 14, paddingHorizontal: S.md }}>
          <Icon name="magnify" size={20} color={C.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Find an exercise" placeholderTextColor={C.faint} style={{ flex: 1, color: C.ink, fontSize: 16, paddingVertical: 10 }} />
        </View>
      ) : null}
      {!rows ? <Loading rows={4} /> : !rows.length ? (
        <Card><Empty icon="trophy-outline" title="No bests yet" text="Log a workout of your own and every exercise shows up here with its best." /></Card>
      ) : (
        <Card style={{ paddingVertical: S.xs }}>
          {shown.map((l, i) => (
            <Pressable key={l.move_id} onPress={() => { tap(); router.push({ pathname: '/lifts', params: { move: l.move_id, user: who } }); }} accessibilityRole="button"
              style={({ pressed }) => [ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.rowTitle}>{l.move_name}</Text>
                <Text style={ui.rowSub}>{l.sessions} {l.sessions === 1 ? 'session' : 'sessions'} · last {friendly(l.last_date)}{l.track === 'weight' && l.best_e1rm ? ` · est. max ${fmtKg(l.best_e1rm)} kg` : ''}</Text>
              </View>
              <Text style={[{ color: C.gold, fontWeight: '800', fontSize: 16 }, ui.num]}>{best(l)}</Text>
              <Icon name="chevron-right" size={18} color={C.faint} />
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function Detail({ lift, moveId, who, onBack }: { lift: LiftSummary | null; moveId: string; who: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<LiftSession2[] | null>(null);
  useEffect(() => { api<LiftSession2[]>(`/api/fit/lifts/${encodeURIComponent(moveId)}?user=${who}`).then(setSessions).catch(() => setSessions([])); }, [moveId, who]);
  const track: Track = lift?.track ?? 'weight';

  // One point per session: best estimated max for lifts, most reps, longest hold or furthest distance otherwise.
  const pts = (sessions ?? []).map((s) => {
    const vals = s.sets.map((x) => (track === 'weight' && x.weight_kg != null && x.reps ? e1rm(x.weight_kg, x.reps)
      : track === 'weight' || track === 'reps' ? x.reps ?? 0 : track === 'time' ? x.seconds ?? 0 : (x.distance_m ?? 0) / 1000 || (x.seconds ?? 0) / 60));
    return { date: s.date, v: Math.max(0, ...vals) };
  }).reverse();
  const chartW = width - S.lg * 4;
  const h = 120;
  const max = Math.max(...pts.map((p) => p.v), 1);
  const min = Math.min(...pts.map((p) => p.v), max);
  const span = Math.max(1, max - min);
  const xy = pts.map((p, i) => ({ x: pts.length > 1 ? 6 + (i / (pts.length - 1)) * (chartW - 12) : chartW / 2, y: h - 10 - ((p.v - min) / span) * (h - 20) }));
  const unit = track === 'weight' ? 'Estimated max (kg)' : track === 'time' ? 'Longest set (seconds)' : track === 'cardio' ? 'Distance (km) or minutes' : 'Most reps in a set';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + 40, gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="arrow-left" color={C.sub} />
        </Pressable>
        <Text style={[ui.h2, { flex: 1 }]} numberOfLines={2}>{lift?.move_name ?? 'Exercise'}</Text>
      </View>
      {lift ? (
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Box label="Best" value={best(lift)} />
          {track === 'weight' && lift.best_e1rm ? <Box label="Est. max" value={`${fmtKg(lift.best_e1rm)} kg`} /> : null}
          <Box label="Sessions" value={String(lift.sessions)} />
        </View>
      ) : null}
      {pts.length > 1 ? (
        <Card style={{ gap: S.sm }}>
          <Text style={ui.label}>{unit}</Text>
          <Svg width={chartW} height={h}>
            <Polyline points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} fill="none" stroke={C.gold} strokeWidth={2.5} strokeLinejoin="round" />
            {xy.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={pts[i].v === max ? C.gold : C.card} stroke={C.gold} strokeWidth={2} />)}
          </Svg>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.faint, fontSize: 11 }}>{friendly(pts[0].date)}</Text>
            <Text style={{ color: C.faint, fontSize: 11 }}>{friendly(pts[pts.length - 1].date)}</Text>
          </View>
        </Card>
      ) : null}
      {!sessions ? <Loading rows={3} /> : sessions.map((s) => (
        <Card key={s.workout_id} style={{ gap: 4 }}>
          <Text style={ui.rowTitle}>{friendly(s.date)}</Text>
          {s.sets.map((x, i) => (
            <Text key={i} style={[{ color: C.sub }, ui.num]}>Set {x.set_no}: {setText(track, x)}{track === 'weight' && x.weight_kg && x.reps && x.reps > 1 ? `  (est. max ${fmtKg(e1rm(x.weight_kg, x.reps))})` : ''}</Text>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <View style={[ui.card, { flex: 1, alignItems: 'center', paddingVertical: S.md, paddingHorizontal: S.xs }]}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={[{ color: C.ink, fontSize: 20, fontWeight: '800' }, ui.num]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}
