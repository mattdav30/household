// GPS tracker for walks and runs: live time, distance and pace on a map, then a summary with splits.
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { api, changes, type Summary } from '../lib/api';
import { useStore } from '../lib/store';
import { local } from '../lib/local';
import { C, S, tint } from '../lib/theme';
import {
  askGps, clearTrack, currentTrack, encodeTrack, finishTrack, fmtKm, fmtPace, fmtTime, onTrack, pauseTrack, quickFix,
  resumeTrack, resumeWatching, startTrack, statsOf, stopWatching, type GpsAccess, type Track, type TrackKind,
} from '../lib/gps';
import { Elevation, RouteMap, Splits } from '../components/RouteMap';
import { Button, Chips, Icon, IconBadge, styles as ui, tap } from '../components/ui';

type Phase = 'ready' | 'live' | 'finish';
const segmentsOf = (tr: Track | null) => {
  if (!tr) return [];
  const out: { lat: number; lng: number }[][] = [];
  tr.points.forEach((p, i) => { if (!i || tr.points[i - 1].seg !== p.seg) out.push([]); out[out.length - 1].push(p); });
  return out;
};

export default function TrackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { partner, apply } = useStore();
  const [phase, setPhase] = useState<Phase>(() => (currentTrack() ? 'live' : 'ready'));
  const [kind, setKind] = useState<TrackKind>(() => currentTrack()?.kind ?? 'walk');
  const [together, setTogether] = useState(false);
  const [access, setAccess] = useState<GpsAccess | null>(null);
  const [fix, setFix] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [, setTick] = useState(0);
  const [effort, setEffort] = useState('2');
  const [busy, setBusy] = useState(false);
  const spokenKm = useRef(0);
  const tr = currentTrack();

  // Ask for location, then find a first fix so the start button shows the GPS is ready.
  useEffect(() => {
    let live = true;
    (async () => {
      const a = await askGps();
      if (!live) return;
      setAccess(a);
      if (a === 'ready' || a === 'foreground') {
        if (currentTrack()) { await resumeWatching(); return; }
        for (let i = 0; i < 6 && live && !currentTrack(); i++) {
          const f = await quickFix();
          if (f && live) setFix(f);
          if (f && f.acc <= 20) break;
        }
      }
    })();
    return () => { live = false; stopWatching(); };
  }, []);

  // Redraw every second while live, and whenever a new GPS fix lands.
  useEffect(() => {
    const off = onTrack(() => setTick((n) => n + 1));
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => { off(); clearInterval(t); };
  }, []);

  // Without background location, the screen has to stay on to keep tracking.
  useEffect(() => {
    if (phase !== 'live' || access !== 'foreground') return;
    activateKeepAwakeAsync('track').catch(() => undefined);
    return () => { deactivateKeepAwake('track'); };
  }, [phase, access]);

  const stats = tr ? statsOf(tr) : null;

  // Spoken split each kilometre.
  useEffect(() => {
    if (!stats || phase !== 'live') return;
    if (stats.splits.length > spokenKm.current) {
      spokenKm.current = stats.splits.length;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (local.voice()) {
        const sp = stats.splits[stats.splits.length - 1];
        Speech.speak(`${stats.splits.length} kilometre${stats.splits.length > 1 ? 's' : ''}. Last one in ${Math.floor(sp / 60)} minutes ${sp % 60} seconds.`, { language: 'en-AU' });
      }
    }
  });
  useEffect(() => { spokenKm.current = stats?.splits.length ?? 0; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phase]);

  const start = async () => {
    if (!access || access === 'denied' || access === 'off') return;
    tap();
    try {
      await startTrack(kind, access);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (local.voice()) Speech.speak(kind === 'run' ? 'Run started.' : 'Walk started.', { language: 'en-AU' });
      setPhase('live');
    } catch (e) { Alert.alert('GPS could not start', (e as Error).message); }
  };
  const togglePause = async () => {
    tap();
    if (tr?.pausedAt) await resumeTrack(); else await pauseTrack();
  };
  const finish = () => Alert.alert(`Finish this ${tr?.kind ?? 'walk'}?`, undefined, [
    { text: 'Keep going', style: 'cancel' },
    { text: 'Finish', onPress: async () => { await finishTrack(); Speech.stop(); setPhase('finish'); } },
  ]);
  const discard = () => Alert.alert('Discard this route?', 'Nothing gets logged.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: async () => { await finishTrack(); clearTrack(); router.back(); } },
  ]);

  const save = async () => {
    if (!tr || !stats) return;
    setBusy(true);
    try {
      const minutes = Math.max(1, Math.round(stats.activeMs / 60000));
      const km = fmtKm(stats.distance);
      const r = await api<{ summary: Summary }>('/api/fit/workouts', {
        method: 'POST',
        body: {
          minutes, kind: tr.kind === 'run' ? 'jog' : 'walk', title: `${km} km ${tr.kind}`, effort: Number(effort), together,
          route: {
            distance_m: Math.round(stats.distance), moving_s: Math.round(stats.activeMs / 1000), elapsed_s: Math.round(stats.elapsedMs / 1000),
            climb_m: stats.climb, descent_m: stats.descent, polyline: encodeTrack(tr.points), splits: stats.splits, profile: stats.profile, started_at: tr.startedAt,
          },
        },
      });
      apply(r.summary);
      changes.emit('workouts');
      clearTrack();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Saved', `${km} km in ${fmtTime(stats.activeMs)}. ${r.summary.pet.name ?? 'Your dog'} says thank you!`, [{ text: 'Done', onPress: () => router.back() }]);
    } catch (e) { Alert.alert('That did not save', `${(e as Error).message} Your route is kept on this phone, so try again in a moment.`); }
    finally { setBusy(false); }
  };

  const mapW = width - S.lg * 2;
  const last = tr?.points[tr.points.length - 1] ?? null;

  if (phase === 'ready') {
    const canStart = access === 'ready' || access === 'foreground';
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, gap: S.md }}>
        <Top title="Track with GPS" onClose={() => router.back()} />
        <RouteMap segments={[]} here={fix} width={mapW} height={Math.min(320, height * 0.36)} />
        <GpsStatus access={access} fix={fix} />
        <Chips label="What are you doing?" value={kind} onChange={(v) => setKind(v as TrackKind)} options={[{ value: 'walk', label: 'Walk' }, { value: 'run', label: 'Run' }]} />
        {partner ? (
          <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md }]}>
            <IconBadge name="account-heart" color={C.warm} />
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>Together with {partner.name}</Text>
              <Text style={ui.rowSub}>Logs the route for both of you</Text>
            </View>
            <Switch value={together} onValueChange={setTogether} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Together with ${partner.name}`} />
          </View>
        ) : null}
        <Button title={kind === 'run' ? 'Start run' : 'Start walk'} icon="play" onPress={start} busy={access == null} />
        {!canStart && access ? <Text style={{ color: C.danger, textAlign: 'center' }}>Location is needed to track a route.</Text> : null}
      </ScrollView>
    );
  }

  if (!tr || !stats) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.lg, paddingTop: insets.top + S.md }}>
        <Top title="Track with GPS" onClose={() => router.back()} />
        <Text style={{ color: C.sub, marginTop: S.lg }}>Nothing being tracked.</Text>
      </View>
    );
  }

  if (phase === 'finish') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, gap: S.md }}>
        <Top title={tr.kind === 'run' ? 'Run done' : 'Walk done'} />
        <RouteMap segments={segmentsOf(tr)} width={mapW} height={260} />
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Big label="Distance" value={fmtKm(stats.distance)} unit="km" />
          <Big label="Avg pace" value={fmtPace(stats.pace)} unit="/km" />
          <Big label="Climb" value={String(stats.climb)} unit="m" />
        </View>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <Big label="Moving time" value={fmtTime(stats.activeMs)} />
          <Big label="Total time" value={fmtTime(stats.elapsedMs)} />
        </View>
        <Elevation profile={stats.profile} climb={stats.climb} descent={stats.descent} width={mapW} />
        <Splits splits={stats.splits} />
        <Chips label="How did that feel?" value={effort} onChange={setEffort} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Solid' }, { value: '3', label: 'Tough' }]} />
        <Button title="Save" icon="check" onPress={save} busy={busy} />
        <Button title="Discard" kind="ghost" onPress={discard} />
      </ScrollView>
    );
  }

  const paused = !!tr.pausedAt;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, paddingHorizontal: S.lg, gap: S.md }}>
      <Top title={paused ? 'Paused' : tr.kind === 'run' ? 'Running' : 'Walking'} sub={access === 'foreground' ? 'Keep Tandem open on screen while you go' : 'Tracking carries on with the screen off'} />
      <RouteMap segments={segmentsOf(tr)} here={paused ? null : last} width={mapW} height={Math.max(200, height * 0.3)} />
      <View style={{ alignItems: 'center' }}>
        <Text style={[{ color: C.ink, fontSize: 64, fontWeight: '800', letterSpacing: -2 }, ui.num]} accessibilityLabel={`${fmtKm(stats.distance)} kilometres`}>{fmtKm(stats.distance)}</Text>
        <Text style={{ color: C.sub, fontWeight: '700', marginTop: -6 }}>KILOMETRES</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Big label="Time" value={fmtTime(stats.activeMs)} />
        <Big label="Avg pace" value={fmtPace(stats.pace)} unit="/km" />
      </View>
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Big label="Pace now" value={fmtPace(stats.nowPace)} unit="/km" />
        <Big label="Climb" value={String(stats.climb)} unit="m" />
      </View>
      {!last && !paused ? <Text style={{ color: C.sub, textAlign: 'center' }}>Finding you… head outside for a clear view of the sky.</Text> : null}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: S.md }}>
        <Pressable onPress={togglePause} accessibilityRole="button" accessibilityLabel={paused ? 'Resume' : 'Pause'}
          style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: 32, backgroundColor: paused ? C.green : C.raised, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1 })}>
          <Icon name={paused ? 'play' : 'pause'} size={26} color={paused ? '#0d1a12' : C.ink} />
          <Text style={{ color: paused ? '#0d1a12' : C.ink, fontWeight: '800', fontSize: 17 }}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Finish"
          style={({ pressed }) => ({ flex: 1, height: 64, borderRadius: 32, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="flag-checkered" size={24} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Finish</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Top({ title, sub, onClose }: { title: string; sub?: string; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <View style={{ flex: 1 }}>
        <Text style={ui.h1}>{title}</Text>
        {sub ? <Text style={ui.rowSub}>{sub}</Text> : null}
      </View>
      {onClose ? (
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="close" color={C.sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={[ui.card, { flex: 1, alignItems: 'center', paddingVertical: S.md, paddingHorizontal: S.xs, gap: 2 }]}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={[{ color: C.ink, fontSize: 22, fontWeight: '800' }, ui.num]} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit ? <Text style={{ fontSize: 12, color: C.sub }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function GpsStatus({ access, fix }: { access: GpsAccess | null; fix: { acc: number } | null }) {
  let icon: 'crosshairs-gps' | 'crosshairs-question' | 'crosshairs-off' = 'crosshairs-question';
  let color = C.gold;
  let text = 'Checking location…';
  let action: null | { label: string; onPress: () => void } = null;
  if (access === 'off') { icon = 'crosshairs-off'; color = C.danger; text = 'Location is switched off on this phone. Turn it on in quick settings.'; }
  else if (access === 'denied') { icon = 'crosshairs-off'; color = C.danger; text = 'Tandem needs location to map your route.'; action = { label: 'Open settings', onPress: () => Linking.openSettings() }; }
  else if (access) {
    if (!fix) text = 'Finding you… a clear view of the sky helps.';
    else if (fix.acc <= 20) { icon = 'crosshairs-gps'; color = C.green; text = `GPS ready, accurate to ${fix.acc} m.`; }
    else text = `Finding a stronger signal (${fix.acc} m).`;
    if (access === 'foreground') {
      text += ' To keep tracking with the screen off, set Location to Allow all the time.';
      action = { label: 'Open settings', onPress: () => Linking.openSettings() };
    }
  }
  return (
    <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, borderColor: tint(color, 0.5) }]}>
      <Icon name={icon} size={24} color={color} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ color: C.ink, fontSize: 14 }}>{text}</Text>
        {action ? <Pressable onPress={action.onPress} accessibilityRole="button"><Text style={{ color: C.accent, fontWeight: '700' }}>{action.label}</Text></Pressable> : null}
      </View>
    </View>
  );
}
