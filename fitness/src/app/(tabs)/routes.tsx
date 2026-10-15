// Routes: every walk and run tracked with GPS, with totals, weekly distance and personal bests.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useStore } from '../../lib/store';
import { api, changes, type Workout } from '../../lib/api';
import { C, S, tint } from '../../lib/theme';
import { friendly } from '../../lib/dates';
import { decodeTrack, fmtKm, fmtPace, fmtTime } from '../../lib/gps';
import { Appear } from '../../components/Appear';
import { ROUTE_BLUE } from '../../components/RouteMap';
import { WorkoutSheet } from '../../components/fit';
import { Card, Empty, Header, Icon, Loading, Segmented, SectionTitle, styles as ui, tap } from '../../components/ui';

type RouteRow = Workout & { moving_s: number; elapsed_s: number | null; climb_m: number; descent_m: number; polyline: string; route_at: number; distance_m: number };
type Kind = 'all' | 'walk' | 'run';
type Stats = {
  totals: { user_id: string; kind: 'walk' | 'run'; n: number; m: number; s: number; climb: number; week_m: number; month_m: number }[];
  weekly: { start: string; by_user: Record<string, number> }[];
  longest: { user_id: string; kind: 'walk' | 'run'; id: string; date: string; m: number }[];
  fastest: { user_id: string; kind: 'walk' | 'run'; id: string; date: string; pace: number }[];
};
const kindOf = (w: { kind: string }) => (w.kind === 'jog' ? 'run' : 'walk');

export default function Routes() {
  const router = useRouter();
  const { summary, name, color, partner } = useStore();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState<RouteRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [kind, setKind] = useState<Kind>('all');
  const [who, setWho] = useState<'both' | 'me' | 'partner'>('both');
  const [open, setOpen] = useState<Workout | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([
      api<{ routes: RouteRow[] }>('/api/fit/routes').catch(() => null),
      api<Stats>('/api/fit/route-stats').catch(() => null),
    ]);
    if (r) setRows(r.routes);
    if (s) setStats(s);
  }, []);
  useEffect(() => { load(); return changes.on(load); }, [load]);

  const me = summary?.me;
  const people = useMemo(() => {
    if (!summary) return [] as string[];
    if (who === 'me') return [summary.me];
    if (who === 'partner' && partner) return [partner.id];
    return summary.members.map((m) => m.id);
  }, [summary, who, partner]);
  const pick = <T extends { user_id: string; kind: 'walk' | 'run' }>(list: T[]) => list.filter((x) => people.includes(x.user_id) && (kind === 'all' || x.kind === kind));

  if (!summary) return <View style={{ flex: 1 }}><Header title="Routes" /><Loading rows={4} /></View>;

  // A walk together counts for both of you, so it shows under either name.
  const shown = (rows ?? []).filter((r) => (kind === 'all' || kindOf(r) === kind) && (who === 'both' || !!r.together || (who === 'me' ? r.user_id === me : r.user_id !== me)));
  const tot = stats ? pick(stats.totals) : [];
  const sum = (k: 'm' | 's' | 'n' | 'climb' | 'week_m' | 'month_m') => tot.reduce((a, t) => a + (t[k] ?? 0), 0);
  const label = kind === 'run' ? 'runs' : kind === 'walk' ? 'walks' : 'walks and runs';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={stats ? `${fmtKm(sum('week_m'))} km this week` : 'GPS walks and runs'} title="Routes"
          right={<Pressable onPress={() => { tap(); router.push('/track'); }} style={ui.headerBtn} accessibilityRole="button" accessibilityLabel="Track a walk or run">
            <Icon name="play" size={19} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '700' }}>Track</Text></Pressable>} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'walk', label: 'Walks' }, { value: 'run', label: 'Runs' }]} />
          {partner ? (
            <Segmented value={who} onChange={setWho} options={[{ value: 'both', label: 'Both of us' }, { value: 'me', label: name(me) }, { value: 'partner', label: partner.name }]} />
          ) : null}

          {rows && !rows.length ? (
            <Card style={{ alignItems: 'center', gap: S.md }}>
              <Empty icon="map-marker-path" title="No routes yet" text="Track a walk or run with GPS and it shows here with its map, pace and splits." />
              <Pressable onPress={() => { tap(); router.push('/track'); }} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: ROUTE_BLUE, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Track a walk or run</Text>
              </Pressable>
            </Card>
          ) : null}

          {stats && sum('n') ? (
            <Appear index={0}>
              <Card style={{ gap: S.md }}>
                <View style={{ flexDirection: 'row' }}>
                  <Big label="This week" value={fmtKm(sum('week_m'))} />
                  <Big label="This month" value={fmtKm(sum('month_m'))} />
                  <Big label="All time" value={fmtKm(sum('m'))} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.sm }}>
                  <Small icon="map-marker-path" text={`${sum('n')} ${label}`} />
                  <Small icon="timer-outline" text={fmtTime(sum('s') * 1000)} />
                  <Small icon="trending-up" text={`${sum('climb')} m climbed`} />
                </View>
              </Card>
            </Appear>
          ) : null}

          {stats && sum('n') ? (
            <Appear index={1}>
              <SectionTitle>Distance each week</SectionTitle>
              <WeeklyKm weekly={stats.weekly} people={people} color={color} width={width - S.lg * 2} />
            </Appear>
          ) : null}

          {stats && sum('n') ? (
            <Appear index={2}>
              <SectionTitle>Personal bests</SectionTitle>
              <Card style={{ gap: S.sm }}>
                {(['walk', 'run'] as const).filter((k) => kind === 'all' || kind === k).flatMap((k) => people.map((pid) => {
                  const long = stats.longest.find((l) => l.user_id === pid && l.kind === k);
                  const fast = stats.fastest.find((f) => f.user_id === pid && f.kind === k);
                  if (!long) return null;
                  return (
                    <View key={`${k}${pid}`} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                      <View style={{ width: 8, height: 34, borderRadius: 4, backgroundColor: color(pid) }} />
                      <View style={{ flex: 1 }}>
                        <Text style={ui.rowTitle}>{name(pid)} · {k === 'run' ? 'Run' : 'Walk'}</Text>
                        <Text style={ui.rowSub}>Longest {fmtKm(long.m)} km{fast ? ` · fastest pace ${fmtPace(fast.pace)} /km` : ''}</Text>
                      </View>
                    </View>
                  );
                })).filter(Boolean)}
              </Card>
            </Appear>
          ) : null}

          {shown.length ? <SectionTitle>All {label}</SectionTitle> : null}
          {!rows ? <Loading rows={3} /> : shown.map((r, i) => (
            <Appear key={r.id} index={Math.min(i + 3, 8)}>
              <RouteCard r={r} who={r.together ? 'Together' : name(r.user_id)} tint={color(r.user_id)} onPress={() => { tap(); setOpen(r); }} />
            </Appear>
          ))}
        </View>
      </ScrollView>
      <WorkoutSheet workout={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[{ color: C.ink, fontSize: 26, fontWeight: '800' }, ui.num]}>{value}<Text style={{ fontSize: 13, color: C.sub }}> km</Text></Text>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
function Small({ icon, text }: { icon: 'map-marker-path' | 'timer-outline' | 'trending-up'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={15} color={C.faint} />
      <Text style={{ color: C.sub, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

/** Twelve weeks of distance, stacked per person. */
function WeeklyKm({ weekly, people, color, width }: { weekly: Stats['weekly']; people: string[]; color: (id: string) => string; width: number }) {
  const totals = weekly.map((w) => people.reduce((a, p) => a + (w.by_user[p] ?? 0), 0));
  const max = Math.max(1000, ...totals);
  const h = 110;
  return (
    <Card style={{ gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: h }}>
        {weekly.map((w, i) => (
          <View key={w.start} style={{ flex: 1, height: h, justifyContent: 'flex-end', borderRadius: 5, overflow: 'hidden', backgroundColor: C.raised }}
            accessibilityLabel={`Week of ${w.start}: ${fmtKm(totals[i])} kilometres`}>
            {people.map((p) => (w.by_user[p] ? <View key={p} style={{ height: ((w.by_user[p] ?? 0) / max) * h, backgroundColor: color(p) }} /> : null))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.faint, fontSize: 11 }}>12 weeks ago</Text>
        <Text style={{ color: C.faint, fontSize: 11 }}>Best week {fmtKm(Math.max(...totals))} km</Text>
        <Text style={{ color: C.faint, fontSize: 11 }}>This week</Text>
      </View>
    </Card>
  );
}

/** One walk or run: the shape of the route beside its numbers. */
function RouteCard({ r, who, tint: tc, onPress }: { r: RouteRow; who: string; tint: string; onPress: () => void }) {
  const size = 92;
  const segs = decodeTrack(r.polyline);
  const pts = segs.flat();
  let shape: string[] = [];
  let start: { x: number; y: number } | null = null;
  let end: { x: number; y: number } | null = null;
  if (pts.length > 1) {
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const k = Math.cos((((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI) / 180);
    const w = (Math.max(...lngs) - Math.min(...lngs)) * k || 1e-6;
    const hgt = Math.max(...lats) - Math.min(...lats) || 1e-6;
    const scale = (size - 18) / Math.max(w, hgt);
    const ox = (size - w * scale) / 2;
    const oy = (size - hgt * scale) / 2;
    const at = (p: { lat: number; lng: number }) => ({ x: ox + (p.lng - Math.min(...lngs)) * k * scale, y: oy + (Math.max(...lats) - p.lat) * scale });
    shape = segs.filter((s) => s.length > 1).map((s) => s.map(at).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
    start = at(pts[0]);
    end = at(pts[pts.length - 1]);
  }
  const pace = r.distance_m > 50 ? r.moving_s / (r.distance_m / 1000) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${r.title}, ${friendly(r.date)}`}
      style={({ pressed }) => [ui.card, { flexDirection: 'row', gap: S.md, padding: S.md, opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: tint(ROUTE_BLUE, 0.08), overflow: 'hidden' }}>
        <Svg width={size} height={size}>
          {shape.map((p, i) => <Polyline key={`g${i}`} points={p} fill="none" stroke={ROUTE_BLUE} strokeOpacity={0.25} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />)}
          {shape.map((p, i) => <Polyline key={`l${i}`} points={p} fill="none" stroke={ROUTE_BLUE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />)}
          {start ? <Circle cx={start.x} cy={start.y} r={3.5} fill="#2BB673" /> : null}
          {end ? <Circle cx={end.x} cy={end.y} r={3.5} fill="#fff" stroke={ROUTE_BLUE} strokeWidth={1.5} /> : null}
        </Svg>
      </View>
      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={kindOf(r) === 'run' ? 'run-fast' : 'walk'} size={16} color={tc} />
          <Text style={[ui.rowSub, { flex: 1 }]} numberOfLines={1}>{who} · {friendly(r.date)}</Text>
        </View>
        <Text style={[{ color: C.ink, fontSize: 22, fontWeight: '800' }, ui.num]}>{fmtKm(r.distance_m)}<Text style={{ fontSize: 13, color: C.sub }}> km</Text></Text>
        <Text style={[{ color: C.sub, fontSize: 13 }, ui.num]}>{fmtPace(pace)} /km · {fmtTime(r.moving_s * 1000)}{r.climb_m ? ` · ↑${r.climb_m} m` : ''}</Text>
      </View>
      <View style={{ alignSelf: 'center' }}><Icon name="chevron-right" size={20} color={C.faint} /></View>
    </Pressable>
  );
}
