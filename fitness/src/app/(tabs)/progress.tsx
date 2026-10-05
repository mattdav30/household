import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useStore } from '../../lib/store';
import { api, changes, type Measurement } from '../../lib/api';
import { C, S } from '../../lib/theme';
import { friendly, today } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Legend, WeeksChart } from '../../components/fit';
import { Photos } from '../../components/Photos';
import { Button, Card, Chips, DateField, Field, Header, Icon, IconBadge, Segmented, SectionTitle, Sheet, styles as ui, tap } from '../../components/ui';

type Tab = 'overview' | 'photos' | 'tape';
const FIELDS: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'hips_cm', label: 'Hips', unit: 'cm' },
  { key: 'chest_cm', label: 'Chest', unit: 'cm' },
  { key: 'arm_cm', label: 'Upper arm', unit: 'cm' },
  { key: 'weight_kg', label: 'Weight (optional)', unit: 'kg' },
];

export default function Progress() {
  const router = useRouter();
  const { summary } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Header eyebrow="Little by little" title="Progress"
          right={<Pressable onPress={() => router.push('/history')} style={ui.headerBtn} accessibilityRole="button"><Icon name="history" size={19} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '700' }}>Log</Text></Pressable>} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'overview', label: 'Overview' }, { value: 'photos', label: 'Photos' }, { value: 'tape', label: 'Tape' }]} />
          {tab === 'overview' ? (summary ? <Overview /> : null) : tab === 'photos' ? <Photos /> : summary ? <Tape me={summary.me} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Overview() {
  const { summary, color } = useStore();
  if (!summary) return null;
  const me = summary.members.find((m) => m.id === summary.me)!;
  const eightWeeks = Object.fromEntries(summary.members.map((m) => [m.id, summary.weeks.reduce((a, w) => a + (w.by_user[m.id] ?? 0), 0)]));
  const earned = summary.badges.filter((b) => b.earned).length;
  return (
    <>
      <Appear index={0}>
        <SectionTitle>Minutes per week</SectionTitle>
        <Card style={{ gap: S.md }}>
          <WeeksChart summary={summary} />
          <Legend summary={summary} values={eightWeeks} unit="min in 8 weeks" />
        </Card>
      </Appear>
      <Appear index={1}>
        <View style={{ flexDirection: 'row', gap: S.md }}>
          {summary.members.map((m) => (
            <Card key={m.id} style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: color(m.id), fontWeight: '800' }}>{m.name}</Text>
              <Text style={[ui.h2, ui.num]}>{m.active_days}</Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>days moved · best streak {summary.streaks[m.id]?.best ?? 0}</Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>Step {m.step}: {m.target} min</Text>
            </Card>
          ))}
        </View>
      </Appear>
      <Appear index={2}>
        <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>{earned} of {summary.badges.length}</Text>}>{me.name}'s badges</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {summary.badges.map((b) => (
            <View key={b.id} style={[ui.card, { width: '48.5%', gap: 6, padding: S.md, opacity: b.earned ? 1 : 0.45 }]} accessibilityLabel={`${b.title}. ${b.desc}. ${b.earned ? 'Earned' : 'Locked'}`}>
              <IconBadge name={(b.earned ? b.icon : 'lock-outline') as never} color={b.earned ? C.gold : C.faint} size={36} />
              <Text style={ui.rowTitle}>{b.title}</Text>
              <Text style={{ color: C.sub, fontSize: 12 }}>{b.desc}</Text>
            </View>
          ))}
        </View>
      </Appear>
    </>
  );
}

function Tape({ me }: { me: string }) {
  const [rows, setRows] = useState<Measurement[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [date, setDate] = useState<string | null>(today());
  const [busy, setBusy] = useState(false);
  const [metric, setMetric] = useState<keyof Measurement>('waist_cm');

  const load = useCallback(() => { api<Measurement[]>('/api/fit/measurements').then(setRows).catch(() => undefined); }, []);
  useEffect(() => { load(); return changes.on(load); }, [load]);

  const mine = useMemo(() => rows.filter((r) => r.user_id === me), [rows, me]);
  const series = mine.filter((r) => r[metric] != null).map((r) => ({ date: r.date, v: r[metric] as number }));
  const firstV = series[0]?.v;
  const lastV = series[series.length - 1]?.v;
  const unit = FIELDS.find((f) => f.key === metric)!.unit;

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { date };
      for (const f of FIELDS) { const n = parseFloat(form[f.key as string] ?? ''); if (!isNaN(n)) body[f.key as string] = n; }
      await api('/api/fit/measurements', { method: 'POST', body });
      setOpen(false); setForm({}); load();
    } catch (e) { Alert.alert('That did not save', (e as Error).message); } finally { setBusy(false); }
  };
  const remove = (m: Measurement) => Alert.alert('Remove this check in?', friendly(m.date), [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => api(`/api/fit/measurements/${m.id}`, { method: 'DELETE' }).then(load).catch(() => undefined) },
  ]);

  return (
    <>
      <Button title="New check in" icon="tape-measure" onPress={() => { setDate(today()); setOpen(true); }} />
      <Chips value={metric as string} onChange={(v) => setMetric(v as keyof Measurement)} options={FIELDS.map((f) => ({ value: f.key as string, label: f.label.replace(' (optional)', '') }))} />
      <Card style={{ gap: S.md }}>
        {series.length >= 2 ? (
          <>
            <Text style={ui.h2}>{lastV! - firstV! <= 0 ? '' : '+'}{(lastV! - firstV!).toFixed(1)} {unit}</Text>
            <Text style={ui.rowSub}>Since {friendly(series[0].date)}. Now {lastV} {unit}.</Text>
            <Spark values={series.map((s) => s.v)} />
          </>
        ) : (
          <Text style={{ color: C.sub }}>{series.length ? `First check in: ${firstV} ${unit}. Your trend shows after the next one.` : 'Measure on the first of each month, same time of day, before breakfast. Waist at the belly button, hips at the widest point.'}</Text>
        )}
      </Card>
      <Text style={{ color: C.faint, fontSize: 12, paddingHorizontal: S.xs }}>Only your own numbers show here.</Text>
      {mine.length ? (
        <Card style={{ paddingVertical: S.xs }}>
          {[...mine].reverse().map((m, i) => (
            <Pressable key={m.id} onLongPress={() => remove(m)} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]} accessibilityHint="Long press to remove">
              <Text style={[ui.rowTitle, { width: 92 }]}>{friendly(m.date)}</Text>
              <Text style={[ui.rowSub, { flex: 1, marginTop: 0 }]} numberOfLines={2}>
                {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label.replace(' (optional)', '')} ${m[f.key]}`).join(' · ')}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Sheet visible={open} title="Check in" onClose={() => setOpen(false)} onSave={save} saving={busy}>
        <DateField label="Date" value={date} onChange={(d) => setDate(d ?? today())} />
        {FIELDS.map((f) => (
          <Field key={f.key as string} label={`${f.label}, ${f.unit}`} value={form[f.key as string] ?? ''} keyboardType="decimal-pad"
            onChangeText={(t) => setForm((x) => ({ ...x, [f.key as string]: t.replace(/[^0-9.]/g, '') }))} />
        ))}
      </Sheet>
    </>
  );
}

function Spark({ values }: { values: number[] }) {
  const [w, setW] = useState(0);
  const h = 90;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(0.5, max - min);
  const pts = values.map((v, i) => ({ x: 8 + (i / Math.max(1, values.length - 1)) * (w - 16), y: 8 + (1 - (v - min) / span) * (h - 16) }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: h }}>
      {w ? (
        <Svg width={w} height={h}>
          <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={C.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? C.accent : C.card} stroke={C.accent} strokeWidth={2} />)}
        </Svg>
      ) : null}
    </View>
  );
}
