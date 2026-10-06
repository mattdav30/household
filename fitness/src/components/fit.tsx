import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { C, S, tint } from '../lib/theme';
import { api, changes, type Summary, type Workout } from '../lib/api';
import { today as todayIso, friendly } from '../lib/dates';
import { useStore } from '../lib/store';
import { Button, Chips, Field, Icon, Sheet, styles as ui, tap, DateField, type IconName } from './ui';

export const accentOf = (c: 'accent' | 'warm' | 'gold' | 'green') => ({ accent: C.accent, warm: C.warm, gold: C.gold, green: C.green })[c];

/** Seven day bars, one stacked segment per person. */
export function WeekBars({ summary, height = 76 }: { summary: Summary; height?: number }) {
  const { color } = useStore();
  const days = summary.week.days;
  const max = Math.max(45, ...days.map((d) => Object.values(d.by_user).reduce((a, b) => a + b, 0)));
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }} accessibilityLabel="Minutes each day this week">
      {days.map((d, i) => {
        const isToday = d.date === summary.today;
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height, width: '100%', borderRadius: 8, backgroundColor: C.raised, justifyContent: 'flex-end', overflow: 'hidden' }}>
              {summary.members.map((m) => {
                const v = d.by_user[m.id] ?? 0;
                return v ? <View key={m.id} style={{ height: Math.max(4, (v / max) * height), backgroundColor: color(m.id) }} /> : null;
              })}
            </View>
            <Text style={{ fontSize: 11, fontWeight: isToday ? '800' : '600', color: isToday ? C.ink : C.sub }}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function Legend({ summary, values, unit = 'min' }: { summary: Summary; values: Record<string, number>; unit?: string }) {
  const { color } = useStore();
  return (
    <View style={{ flexDirection: 'row', gap: S.lg, flexWrap: 'wrap' }}>
      {summary.members.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color(m.id) }} />
          <Text style={{ color: C.sub, fontSize: 13 }}>{m.name} <Text style={{ color: C.ink, fontWeight: '700' }}>{values[m.id] ?? 0} {unit}</Text></Text>
        </View>
      ))}
    </View>
  );
}

const KIND_OPTIONS: { value: string; label: string; icon: IconName }[] = [
  { value: 'walk', label: 'Walk', icon: 'walk' },
  { value: 'home', label: 'Home workout', icon: 'arm-flex' },
  { value: 'jog', label: 'Jog', icon: 'run' },
  { value: 'stairs', label: 'Stairs', icon: 'stairs' },
  { value: 'dance', label: 'Dance', icon: 'music-note' },
  { value: 'stretch', label: 'Stretch', icon: 'yoga' },
  { value: 'outdoor', label: 'Bike or hike', icon: 'bike' },
  { value: 'sport', label: 'Sport', icon: 'tennis' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];
export const kindIcon = (k: string): IconName => KIND_OPTIONS.find((o) => o.value === k)?.icon ?? (k === 'partner' ? 'account-heart' : 'run');

/** Log something done outside the app, like a walk to work or a game of tennis. */
export function LogSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: (minutes: number) => void }) {
  const { apply, partner } = useStore();
  const [kind, setKind] = useState('walk');
  const [minutes, setMinutes] = useState('20');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(todayIso());
  const [effort, setEffort] = useState('2');
  const [together, setTogether] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (visible) { setMinutes('20'); setTitle(''); setDate(todayIso()); setTogether(false); setError(null); } }, [visible]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const label = title.trim() || KIND_OPTIONS.find((o) => o.value === kind)?.label || 'Workout';
      const r = await api<{ summary: Summary }>('/api/fit/workouts', { method: 'POST', body: { kind, minutes: Number(minutes), title: label, date, effort: Number(effort), together } });
      apply(r.summary);
      changes.emit('workouts');
      onSaved?.(Number(minutes));
      onClose();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} title="Log activity" onClose={onClose} onSave={save} saving={busy} saveLabel="Log it">
      <Chips label="What" value={kind} onChange={setKind} options={KIND_OPTIONS.map(({ value, label }) => ({ value, label }))} />
      <View style={{ flexDirection: 'row', gap: S.md }}>
        <View style={{ flex: 1 }}>
          <Field label="Minutes" value={minutes} onChangeText={(t) => setMinutes(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" maxLength={3} />
        </View>
        <DateField label="When" value={date} onChange={(d) => setDate(d ?? todayIso())} />
      </View>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        {[10, 20, 30, 45, 60].map((m) => (
          <Pressable key={m} onPress={() => { tap(); setMinutes(String(m)); }} style={[ui.chip, minutes === String(m) && { backgroundColor: C.accentSoft, borderColor: C.accent }]}>
            <Text style={ui.chipText}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Name (optional)" value={title} onChangeText={setTitle} placeholder="Walk to the shops" />
      <Chips label="How hard" value={effort} onChange={setEffort} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Solid' }, { value: '3', label: 'Tough' }]} />
      {partner ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ flex: 1 }}>
            <Text style={ui.rowTitle}>Together with {partner.name}</Text>
            <Text style={ui.rowSub}>Logs the same minutes for both of you</Text>
          </View>
          <Switch value={together} onValueChange={setTogether} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
        </View>
      ) : null}
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
    </Sheet>
  );
}

export function friendlyDay(date: string) { return friendly(date); }

/** Big number with a caption, used across the dashboards. */
export function Stat({ value, label, color = C.ink, icon }: { value: string; label: string; color?: string; icon?: IconName }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={18} color={color} /> : null}
        <Text style={[{ fontSize: 24, fontWeight: '800', color, letterSpacing: -0.5 }, ui.num]}>{value}</Text>
      </View>
      <Text style={{ fontSize: 12, color: C.sub, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Eight weeks of minutes, one stacked bar per week. */
export function WeeksChart({ summary, height = 110 }: { summary: Summary; height?: number }) {
  const { color } = useStore();
  const totals = summary.weeks.map((w) => Object.values(w.by_user).reduce((a, b) => a + b, 0));
  const max = Math.max(60, ...totals);
  return (
    <View style={{ gap: 6 }} accessibilityLabel={`Minutes per week for the last eight weeks: ${totals.join(', ')}`}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', height }}>
        {summary.weeks.map((w, i) => (
          <View key={w.start} style={{ flex: 1, height, justifyContent: 'flex-end' }}>
            <View style={{ borderRadius: 6, overflow: 'hidden', backgroundColor: totals[i] ? 'transparent' : C.raised, minHeight: 4 }}>
              {summary.members.map((m) => {
                const v = w.by_user[m.id] ?? 0;
                return v ? <View key={m.id} style={{ height: (v / max) * height, backgroundColor: i === summary.weeks.length - 1 ? color(m.id) : tint(color(m.id), 0.7) }} /> : null;
              })}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.faint, fontSize: 11 }}>8 weeks ago</Text>
        <Text style={{ color: C.faint, fontSize: 11 }}>This week</Text>
      </View>
    </View>
  );
}

/** Details of one logged session, with Delete. Shared sessions delete for both of you. */
export function WorkoutSheet({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
  const { refresh, name } = useStore();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!workout) return;
    setBusy(true);
    try {
      await api(`/api/fit/workouts/${workout.id}`, { method: 'DELETE' });
      changes.emit('workouts');
      await refresh();
      onClose();
    } catch (e) { Alert.alert('That did not delete', (e as Error).message); } finally { setBusy(false); }
  };
  const confirm = () => Alert.alert('Delete this session?', workout?.together ? 'It was logged for both of you, so it goes from both.' : 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove },
  ]);
  return (
    <Sheet visible={!!workout} title={workout?.title ?? ''} onClose={onClose}>
      {workout ? (
        <View style={{ gap: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <Icon name={kindIcon(workout.kind)} size={28} color={C.accent} />
            <Text style={[ui.h2, ui.num]}>{workout.minutes} min</Text>
          </View>
          <Text style={{ color: C.sub }}>{name(workout.user_id)} · {friendly(workout.date)}{workout.together ? ' · together' : ''}{(workout as Workout & { source?: string | null }).source ? ' · from Samsung Health' : ''}</Text>
          <Text style={{ color: C.sub }}>Effort: {['', 'Easy', 'Solid', 'Tough'][workout.effort] ?? 'Solid'}</Text>
          <Button title="Delete session" kind="danger" icon="trash-can-outline" onPress={confirm} busy={busy} />
        </View>
      ) : null}
    </Sheet>
  );
}

/** A tappable row for a logged session. */
export function WorkoutRow({ w, first, onPress }: { w: Workout; first?: boolean; onPress: () => void }) {
  const { name, color } = useStore();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityHint="Opens details, where you can delete it"
      style={({ pressed }) => [ui.row, !first && { borderTopWidth: 1, borderTopColor: C.line }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: tint(color(w.user_id), 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={kindIcon(w.kind)} size={18} color={color(w.user_id)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ui.rowTitle} numberOfLines={1}>{w.title}</Text>
        <Text style={ui.rowSub}>{name(w.user_id)} · {friendly(w.date)}{w.together ? ' · together' : ''}</Text>
      </View>
      <Text style={[{ color: C.ink, fontWeight: '700' }, ui.num]}>{w.minutes} min</Text>
      <Icon name="chevron-right" size={18} color={C.faint} />
    </Pressable>
  );
}
