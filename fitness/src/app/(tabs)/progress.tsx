import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useStore } from '../../lib/store';
import { api, changes, type Measurement } from '../../lib/api';
import { deletePhoto, listPhotos, POSES, type Photo, type Pose } from '../../lib/photos';
import { C, S } from '../../lib/theme';
import { friendly, monthLabel, today } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, DateField, Field, Header, Icon, IconBadge, Segmented, SectionTitle, Sheet, styles as ui, tap } from '../../components/ui';

type Tab = 'photos' | 'tape';
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
  const [tab, setTab] = useState<Tab>('photos');
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Header eyebrow="Check in monthly" title="Progress" subtitle="The tape measure and photos show change before the scale does."
          right={<Pressable onPress={() => router.push('/history')} style={ui.headerBtn} accessibilityRole="button"><Icon name="history" size={19} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '700' }}>Log</Text></Pressable>} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'photos', label: 'Photos' }, { value: 'tape', label: 'Measurements' }]} />
          {tab === 'photos' ? <Photos /> : summary ? <Tape me={summary.me} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Photos() {
  const router = useRouter();
  const [pose, setPose] = useState<Pose>('front');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [view, setView] = useState<Photo | null>(null);
  const [compare, setCompare] = useState(false);
  const load = useCallback(() => { try { setPhotos(listPhotos()); } catch { setPhotos([]); } }, []);
  useFocusEffect(load);

  const forPose = photos.filter((p) => p.pose === pose);
  const first = forPose[0];
  const latest = forPose[forPose.length - 1];
  const w = (Dimensions.get('window').width - S.lg * 2 - S.sm * 2) / 3;

  return (
    <>
      <Appear index={0}>
        <Card style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
          <IconBadge name="lock-outline" color={C.green} />
          <Text style={{ color: C.sub, flex: 1, fontSize: 13, lineHeight: 19 }}>Photos stay on this phone only. They never upload, and nobody else sees them unless you show them.</Text>
        </Card>
      </Appear>
      <Chips value={pose} onChange={setPose} options={POSES} />
      <Button title={`Take ${pose} photo`} icon="camera-outline" onPress={() => { tap(); router.push({ pathname: '/camera', params: { pose } }); }} />

      {first && latest && first !== latest ? (
        <>
          <SectionTitle right={<Pressable onPress={() => setCompare(true)}><Text style={{ color: C.accent, fontWeight: '700' }}>Full screen</Text></Pressable>}>Then and now</SectionTitle>
          <Pressable onPress={() => setCompare(true)} style={{ flexDirection: 'row', gap: S.sm }}>
            {[first, latest].map((p) => (
              <View key={p.name} style={{ flex: 1, gap: 6 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: C.raised }} />
                <Text style={{ color: C.sub, fontSize: 12, textAlign: 'center' }}>{friendly(p.date)}</Text>
              </View>
            ))}
          </Pressable>
        </>
      ) : null}

      <SectionTitle>All {pose} photos</SectionTitle>
      {forPose.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {[...forPose].reverse().map((p) => (
            <Pressable key={p.name} onPress={() => setView(p)} accessibilityLabel={`Photo from ${friendly(p.date)}`}>
              <Image source={{ uri: p.uri }} style={{ width: w, height: w * 4 / 3, borderRadius: 12, backgroundColor: C.raised }} />
              <Text style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>{monthLabel(p.date)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ color: C.sub }}>No {pose} photos yet. Take your first today so you have a clear before.</Text>
      )}

      <Modal visible={!!view} transparent animationType="fade" onRequestClose={() => setView(null)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          {view ? <Image source={{ uri: view.uri }} style={{ width: '100%', aspectRatio: 3 / 4 }} resizeMode="contain" /> : null}
          <View style={{ position: 'absolute', bottom: 40, left: S.lg, right: S.lg, flexDirection: 'row', gap: S.md }}>
            <View style={{ flex: 1 }}><Button title="Close" kind="soft" onPress={() => setView(null)} /></View>
            <View style={{ flex: 1 }}>
              <Button title="Delete" kind="danger" onPress={() => Alert.alert('Delete this photo?', 'It is only stored on this phone, so this cannot be undone.', [
                { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deletePhoto(view!); setView(null); load(); } },
              ])} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={compare} transparent animationType="fade" onRequestClose={() => setCompare(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: S.sm }} onPress={() => setCompare(false)}>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            {first && latest ? [first, latest].map((p) => (
              <View key={p.name} style={{ flex: 1 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }} />
                <Text style={{ color: '#fff', textAlign: 'center', marginTop: 8, fontWeight: '700' }}>{friendly(p.date)}</Text>
              </View>
            )) : null}
          </View>
          <Text style={{ color: '#aaa', textAlign: 'center', marginTop: S.xl }}>Tap to close</Text>
        </Pressable>
      </Modal>
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
