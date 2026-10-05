import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Switch, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { C, S, tint } from '../lib/theme';
import { reduceMotion } from '../lib/motion';
import { api, changes, type Summary } from '../lib/api';
import { today as todayIso, friendly } from '../lib/dates';
import { useStore } from '../lib/store';
import { Chips, Field, Icon, Sheet, styles as ui, tap, DateField, type IconName } from './ui';
import { TYPE_INFO, type SessionType } from '../lib/plan';

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

/** A thin progress bar split by person. */
export function SplitBar({ summary, values, goal }: { summary: Summary; values: Record<string, number>; goal: number }) {
  const { color } = useStore();
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: C.raised, flexDirection: 'row', overflow: 'hidden' }}>
      {summary.members.map((m) => (
        <View key={m.id} style={{ width: `${Math.min(100, ((values[m.id] ?? 0) / Math.max(1, goal)) * 100)}%`, backgroundColor: color(m.id) }} />
      ))}
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

/** Route from Brisbane to the onsen, drawn from the stop coordinates. The travelled part glows. */
export function RouteMap({ summary, height = 300, onStop }: { summary: Summary; height?: number; onStop?: (i: number) => void }) {
  const [w, setW] = useState(0);
  const { stops, km } = summary.journey;
  const pts = useMemo(() => {
    if (!w) return [];
    const lats = stops.map((s) => s.lat);
    const lons = stops.map((s) => s.lon);
    const pad = 26;
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const sx = (w - pad * 2) / (maxLon - minLon);
    const sy = (height - pad * 2) / (maxLat - minLat);
    return stops.map((s) => ({ x: pad + (s.lon - minLon) * sx, y: height - pad - (s.lat - minLat) * sy }));
  }, [w, height, stops]);

  // Position of the marker between stops.
  let marker = pts[0];
  const travelled: { x: number; y: number }[] = pts.length ? [pts[0]] : [];
  for (let i = 1; i < pts.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (km >= b.km) { travelled.push(pts[i]); marker = pts[i]; continue; }
    const t = Math.max(0, (km - a.km) / Math.max(1, b.km - a.km));
    marker = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    travelled.push(marker);
    break;
  }
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: 16, backgroundColor: C.raised, overflow: 'hidden' }}
      accessibilityLabel={`Map. ${km} of ${summary.journey.total_km} kilometres travelled.`}>
      {w ? (
        <Svg width={w} height={height}>
          {Array.from({ length: 6 }, (_, i) => (
            <Line key={i} x1={0} x2={w} y1={(height / 6) * i + 20} y2={(height / 6) * i + 20} stroke={C.line} strokeWidth={1} strokeDasharray="2 6" />
          ))}
          <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={C.faint} strokeWidth={2} strokeDasharray="4 5" />
          <Polyline points={travelled.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => {
            const st = stops[i];
            const last = i === pts.length - 1;
            const labelLeft = p.x > w * 0.62;
            return (
              <G key={st.name} onPress={onStop ? () => onStop(i) : undefined}>
                <Circle cx={p.x} cy={p.y} r={last ? 8 : 5} fill={st.reached ? (last ? C.gold : C.accent) : C.card} stroke={last ? C.gold : st.reward ? C.warm : C.faint} strokeWidth={2} />
                {(i % 2 === 0 || last || i === summary.journey.next) ? (
                  <SvgText x={labelLeft ? p.x - 10 : p.x + 10} y={p.y + 4} fontSize={10} fontWeight="700" fill={st.reached ? C.ink : C.sub} textAnchor={labelLeft ? 'end' : 'start'}>{st.name}</SvgText>
                ) : null}
              </G>
            );
          })}
          {marker ? <Circle cx={marker.x} cy={marker.y} r={7} fill={C.warm} stroke={C.bg} strokeWidth={2} /> : null}
        </Svg>
      ) : null}
      {marker && w && !reduceMotion() ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: marker.x - 16, top: marker.y - 16, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: C.warm,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
        }} />
      ) : null}
    </View>
  );
}

/** Spinning wheel that picks a session when nobody wants to choose. */
export function Wheel({ options, onPicked }: { options: SessionType[]; onPicked: (t: SessionType) => void }) {
  const size = 260;
  const r = size / 2;
  const spin = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  const turns = useRef(0);
  const seg = 360 / options.length;

  const go = () => {
    if (busy) return;
    tap();
    setBusy(true);
    const pick = Math.floor(Math.random() * options.length);
    // The pointer sits at the top. Land the middle of the picked slice under it.
    const target = turns.current + 4 * 360 + (360 - (pick * seg + seg / 2)) - (turns.current % 360);
    turns.current = target;
    const done = () => { setBusy(false); onPicked(options[pick]); };
    if (reduceMotion()) { spin.setValue(target); done(); return; }
    Animated.timing(spin, { toValue: target, duration: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(done);
  };

  const slice = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    return `M ${r} ${r} L ${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)} Z`;
  };

  return (
    <View style={{ alignItems: 'center', gap: S.lg }}>
      <View style={{ width: size, height: size + 14 }}>
        <View style={{ position: 'absolute', top: 0, left: r - 12, zIndex: 2 }}>
          <Icon name="menu-down" size={34} color={C.ink} />
        </View>
        <Animated.View style={{ marginTop: 14, transform: [{ rotate: spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }}>
          <Svg width={size} height={size}>
            {options.map((t, i) => {
              const info = TYPE_INFO[t];
              const mid = ((i * seg + seg / 2 - 90) * Math.PI) / 180;
              const col = accentOf(info.color);
              return (
                <G key={t}>
                  <Path d={slice(i)} fill={tint(col, i % 2 ? 0.28 : 0.45)} stroke={C.bg} strokeWidth={2} />
                  <SvgText x={r + r * 0.62 * Math.cos(mid)} y={r + r * 0.62 * Math.sin(mid) + 4} fontSize={11} fontWeight="800" fill={C.ink} textAnchor="middle"
                    transform={`rotate(${i * seg + seg / 2}, ${r + r * 0.62 * Math.cos(mid)}, ${r + r * 0.62 * Math.sin(mid)})`}>
                    {info.short}
                  </SvgText>
                </G>
              );
            })}
            <Circle cx={r} cy={r} r={24} fill={C.card} stroke={C.line} strokeWidth={2} />
          </Svg>
        </Animated.View>
      </View>
      <Pressable onPress={go} disabled={busy} accessibilityRole="button" accessibilityLabel="Spin the wheel"
        style={({ pressed }) => [ui.btn, { backgroundColor: C.accent, alignSelf: 'stretch', opacity: pressed || busy ? 0.7 : 1 }]}>
        <Text style={[ui.btnText, { color: C.onAccent }]}>{busy ? 'Spinning…' : 'Spin'}</Text>
      </Pressable>
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
