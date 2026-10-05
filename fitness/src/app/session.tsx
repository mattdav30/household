import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useStore } from '../lib/store';
import { buildSession, TYPE_INFO, type Session, type SessionType, type Step } from '../lib/plan';
import { byId, EQUIPMENT } from '../lib/exercises';
import { local } from '../lib/local';
import { api, changes, type Summary } from '../lib/api';
import { C, S, tint } from '../lib/theme';
import { money } from '../lib/dates';
import { reduceMotion } from '../lib/motion';
import { Button, Chips, Icon, IconBadge, styles as ui, tap } from '../components/ui';
import { accentOf } from '../components/fit';

type Phase = 'preview' | 'run' | 'finish' | 'done';

export default function SessionScreen() {
  const params = useLocalSearchParams<{ type?: string; shuffle?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, planInput, partner } = useStore();
  const type = (params.type ?? 'strength') as SessionType;
  const [together, setTogether] = useState(type === 'partner' || type === 'dance');
  const [phase, setPhase] = useState<Phase>('preview');
  const [elapsed, setElapsed] = useState(0);

  // Doing it together uses the gentler of the two levels so you stay in sync.
  const session = useMemo<Session | null>(() => {
    const lowest = Math.min(...(summary?.members.map((m) => m.level) ?? [1]));
    const p = planInput(together && partner ? { level: lowest, shuffle: Number(params.shuffle ?? 0) } : { shuffle: Number(params.shuffle ?? 0) });
    return p ? buildSession(type, p) : null;
  }, [planInput, type, together, partner, summary, params.shuffle]);

  if (!session || !summary) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  if (phase === 'run') {
    return <Player session={session} onExit={(secs, finished) => { setElapsed(secs); setPhase(finished || secs >= 60 ? 'finish' : 'preview'); }} />;
  }
  if (phase === 'finish' || phase === 'done') {
    return <Finish session={session} seconds={elapsed} together={together} onDone={() => router.back()} />;
  }

  const info = TYPE_INFO[session.type];
  const col = accentOf(info.color);
  const moves = [...new Map(session.steps.filter((s) => s.exId && (s.kind === 'work' || s.kind === 'move')).map((s) => [s.exId!, byId(s.exId!)!])).values()];
  const gear = [...new Set(moves.map((m) => m.equip).filter((e) => e !== 'none'))];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: 140, gap: S.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="close" color={C.sub} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <IconBadge name={info.icon as never} color={col} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={ui.h1}>{session.title}</Text>
            <Text style={ui.headerSub}>{session.minutes} minutes</Text>
          </View>
        </View>
        <Text style={{ color: C.sub, fontSize: 15, lineHeight: 22 }}>{session.note ?? session.blurb}</Text>
        {session.place ? (
          <View style={[ui.card, { flexDirection: 'row', gap: S.md, alignItems: 'center' }]}>
            <IconBadge name="map-marker" color={C.warm} />
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>{session.place.name}</Text>
              <Text style={ui.rowSub}>{session.place.tip}</Text>
            </View>
          </View>
        ) : null}
        {partner ? (
          <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md }]}>
            <IconBadge name="account-heart" color={C.warm} />
            <View style={{ flex: 1 }}>
              <Text style={ui.rowTitle}>Doing this with {partner.name}</Text>
              <Text style={ui.rowSub}>Logs for both of you, paced for whoever started easier</Text>
            </View>
            <Switch value={together} onValueChange={setTogether} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
          </View>
        ) : null}
        {gear.length ? (
          <Text style={{ color: C.sub, fontSize: 13 }}>You need: {gear.map((g) => EQUIPMENT.find((e) => e.value === g)?.label.toLowerCase()).join(', ')}</Text>
        ) : null}

        <Text style={[ui.section, { marginTop: S.md }]}>{moves.length ? 'The moves' : 'The plan'}</Text>
        {moves.length ? moves.map((m) => <MoveCard key={m.id} id={m.id} />) : (
          <View style={[ui.card, { paddingVertical: S.xs }]}>
            {session.steps.map((s, i) => (
              <View key={i} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                <Text style={[ui.rowTitle, { flex: 1 }]}>{s.name}</Text>
                <Text style={[{ color: C.sub }, ui.num]}>{fmt(s.seconds)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: S.lg, paddingBottom: insets.bottom + S.lg, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line }}>
        <Button title="Start" icon="play" onPress={() => { tap(); setPhase('run'); }} />
      </View>
    </View>
  );
}

function MoveCard({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const e = byId(id)!;
  return (
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[ui.card, { gap: 6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[ui.rowTitle, { flex: 1 }]}>{e.name}{e.sides ? ' (each side)' : ''}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} color={C.faint} />
      </View>
      {open ? (
        <>
          <Text style={{ color: C.sub, lineHeight: 20 }}>{e.how}</Text>
          {e.easier ? <Text style={{ color: C.green, fontSize: 13 }}>Easier: {e.easier}</Text> : null}
          {e.harder ? <Text style={{ color: C.gold, fontSize: 13 }}>Harder: {e.harder}</Text> : null}
        </>
      ) : null}
    </Pressable>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function stepColor(s: Step) {
  return s.kind === 'rest' ? C.green : s.kind === 'warm' || s.kind === 'cool' ? C.gold : s.kind === 'move' ? C.warm : C.accent;
}

/** The timer. Speaks each move, buzzes on the last three seconds, keeps the screen on. */
function Player({ session, onExit }: { session: Session; onExit: (seconds: number, finished: boolean) => void }) {
  // Keep the screen on while the timer runs.
  useEffect(() => {
    activateKeepAwakeAsync('workout').catch(() => undefined);
    return () => { deactivateKeepAwake('workout').catch(() => undefined); };
  }, []);
  const insets = useSafeAreaInsets();
  const steps = session.steps;
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(steps[0].seconds * 1000);
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(local.voice());
  const startedAt = useRef(Date.now());
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const stepEnd = useRef(Date.now() + steps[0].seconds * 1000);
  const lastBeep = useRef(-1);
  const saidHalf = useRef(false);

  const say = (t: string) => { if (voice) { Speech.stop(); Speech.speak(t, { language: 'en-AU', rate: 1.0 }); } };
  const total = steps.reduce((t, s) => t + s.seconds, 0);
  const doneBefore = steps.slice(0, idx).reduce((t, s) => t + s.seconds, 0);
  const step = steps[idx];
  const next = steps[idx + 1];
  const ex = step.exId ? byId(step.exId) : undefined;

  const activeSeconds = () => Math.round((Date.now() - startedAt.current - pausedTotal.current - (pausedAt.current ? Date.now() - pausedAt.current : 0)) / 1000);

  const goTo = (i: number) => {
    if (i >= steps.length) { say('Workout complete. Great work.'); onExit(activeSeconds(), true); return; }
    const s = steps[Math.max(0, i)];
    setIdx(Math.max(0, i));
    stepEnd.current = Date.now() + s.seconds * 1000;
    setLeft(s.seconds * 1000);
    lastBeep.current = -1;
    saidHalf.current = false;
    say(s.kind === 'rest' ? `Rest. ${s.cue ?? ''}` : s.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  useEffect(() => { say(`Let's go. ${steps[0].name}`); return () => { Speech.stop(); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const ms = stepEnd.current - Date.now();
      setLeft(Math.max(0, ms));
      const secs = Math.ceil(ms / 1000);
      if (secs <= 3 && secs > 0 && secs !== lastBeep.current) {
        lastBeep.current = secs;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        if (secs === 3 && steps[idx + 1] && steps[idx].seconds >= 15) say(steps[idx + 1].kind === 'rest' ? 'Rest coming' : `Next, ${steps[idx + 1].name}`);
      }
      if (!saidHalf.current && steps[idx].cue?.includes('Switch sides') && ms <= (steps[idx].seconds * 1000) / 2) {
        saidHalf.current = true;
        say('Switch sides');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      }
      if (ms <= 0) goTo(idx + 1);
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, voice]);

  const togglePause = () => {
    tap();
    if (paused) {
      const p = Date.now() - (pausedAt.current ?? Date.now());
      pausedTotal.current += p;
      stepEnd.current += p;
      pausedAt.current = null;
      setPaused(false);
    } else {
      pausedAt.current = Date.now();
      setPaused(true);
      Speech.stop();
    }
  };

  const end = () => {
    Alert.alert('End the workout?', 'Your minutes so far still count.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End and save', onPress: () => { Speech.stop(); onExit(activeSeconds(), false); } },
    ]);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { end(); return true; });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const col = stepColor(step);
  const frac = step.seconds ? 1 - left / (step.seconds * 1000) : 1;
  const size = 260;
  const rad = 118;
  const circ = 2 * Math.PI * rad;
  const overall = (doneBefore + step.seconds * frac) / total;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, paddingHorizontal: S.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Pressable onPress={end} accessibilityRole="button" accessibilityLabel="End workout" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="close" color={C.sub} />
        </Pressable>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.raised, overflow: 'hidden' }}>
          <View style={{ height: 6, width: `${overall * 100}%`, backgroundColor: C.accent }} />
        </View>
        <Pressable onPress={() => { tap(); setVoice(!voice); local.setVoice(!voice); if (voice) Speech.stop(); }} accessibilityRole="switch" accessibilityState={{ checked: voice }} accessibilityLabel="Spoken cues"
          style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name={voice ? 'volume-high' : 'volume-off'} color={C.sub} />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.lg }}>
        <Text style={{ color: col, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 }}>
          {step.kind === 'rest' ? 'REST' : step.kind === 'warm' ? 'WARM UP' : step.kind === 'cool' ? 'COOL DOWN' : 'GO'}
        </Text>
        <Text style={[ui.h1, { textAlign: 'center' }]} accessibilityLiveRegion="polite">{step.name}</Text>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Circle cx={size / 2} cy={size / 2} r={rad} stroke={C.raised} strokeWidth={14} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={rad} stroke={col} strokeWidth={14} fill="none" strokeLinecap="round"
              strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * frac} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          </Svg>
          <Text style={[{ fontSize: 72, fontWeight: '800', color: C.ink, letterSpacing: -2 }, ui.num]}>{Math.ceil(left / 1000)}</Text>
          {paused ? <Text style={{ color: C.gold, fontWeight: '800' }}>PAUSED</Text> : null}
        </View>
        {step.cue ? <Text style={{ color: C.sub, fontSize: 15, textAlign: 'center' }}>{step.cue}</Text> : null}
        {ex && step.kind !== 'rest' ? <Text style={{ color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 360 }}>{ex.how}</Text> : null}
      </View>

      {next ? (
        <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.lg }]}>
          <Text style={{ color: C.sub, fontWeight: '700' }}>Next</Text>
          <Text style={[ui.rowTitle, { flex: 1 }]} numberOfLines={1}>{next.name}</Text>
          <Text style={[{ color: C.sub }, ui.num]}>{fmt(next.seconds)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xl }}>
        <RoundButton icon="skip-previous" label="Previous" onPress={() => goTo(idx - 1)} />
        <RoundButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume' : 'Pause'} onPress={togglePause} big />
        <RoundButton icon="skip-next" label="Skip" onPress={() => goTo(idx + 1)} />
      </View>
    </View>
  );
}

function RoundButton({ icon, label, onPress, big }: { icon: 'play' | 'pause' | 'skip-next' | 'skip-previous'; label: string; onPress: () => void; big?: boolean }) {
  const s = big ? 84 : 60;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: s, height: s, borderRadius: s / 2, backgroundColor: big ? C.accent : C.raised, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
      <Icon name={icon} size={big ? 40 : 28} color={big ? C.onAccent : C.ink} />
    </Pressable>
  );
}

/** Save the session, then show what it earned: distance, the fund and the streak. */
function Finish({ session, seconds, together, onDone }: { session: Session; seconds: number; together: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { summary, apply } = useStore();
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(seconds / 60)));
  const [effort, setEffort] = useState('2');
  const [saved, setSaved] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pop = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api<{ summary: Summary }>('/api/fit/workouts', {
        method: 'POST', body: { minutes, kind: session.logKind, title: session.title, effort: Number(effort), together },
      });
      apply(r.summary);
      changes.emit('workouts');
      setSaved(r.summary);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (!reduceMotion()) Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (saved && summary) {
    const sj = saved.journey;
    const kmGained = sj ? Math.round(minutes * (together ? summary.members.length : 1) * sj.km_per_minute) : 0;
    const newlyReached = sj && summary.journey?.id === sj.id ? sj.stops.filter((s) => s.reached && !summary.journey!.stops[s.index]?.reached) : [];
    const next = sj && sj.next != null ? sj.stops[sj.next] : null;
    const streak = saved.streaks[saved.me];
    const coin = !summary.streaks[summary.me]?.done_today && minutes >= 10;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: S.lg, paddingTop: insets.top + 60, paddingBottom: insets.bottom + S.lg }}>
        <Animated.View style={{ alignItems: 'center', gap: S.md, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], opacity: pop }}>
          <IconBadge name="party-popper" color={C.gold} size={84} />
          <Text style={[ui.h1, { textAlign: 'center' }]}>{minutes} minutes done</Text>
          <Text style={[ui.headerSub, { textAlign: 'center' }]}>{together ? 'Logged for both of you.' : 'Every minute moves you both along.'}</Text>
        </Animated.View>
        <View style={{ gap: S.md, marginTop: S.xl }}>
          {sj && !(summary.journey?.complete) ? (
            <Earned icon="airplane" color={C.accent} title={`+${kmGained} km on ${sj.title}`}
              sub={next ? `${(next.km - sj.km).toLocaleString()} km to ${next.name}` : `You reached ${sj.stops[sj.stops.length - 1].name}`} />
          ) : null}
          {newlyReached.map((s) => (
            <Earned key={s.name} icon="map-marker-check" color={C.warm} title={`You reached ${s.name}`} sub={s.reward ? `Reward unlocked: ${s.reward}` : s.note} />
          ))}
          <Earned icon="fire" color={C.gold} title={`${streak?.days ?? 0} day streak`} sub={streak?.days && streak.days > 1 ? 'Keep the chain going tomorrow.' : 'Day one of the chain.'} />
          {coin ? <Earned icon="piggy-bank" color={C.green} title={`+${money(saved.jar.rate_cents)} in the fund`} sub={`${money(saved.jar.earned_cents - saved.jar.banked_cents)} ready to move to savings`} /> : null}
        </View>
        <View style={{ flex: 1 }} />
        <Button title="Done" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: S.lg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + S.lg, gap: S.lg }}>
      <Text style={ui.h1}>Nice work</Text>
      <Text style={ui.headerSub}>Check the minutes, then save.</Text>
      <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Pressable onPress={() => setMinutes(Math.max(1, minutes - 1))} style={ui.closeBtn} accessibilityLabel="One minute less"><Icon name="minus" color={C.ink} /></Pressable>
        <Text style={[{ fontSize: 44, fontWeight: '800', color: C.ink }, ui.num]}>{minutes}<Text style={{ fontSize: 18, color: C.sub }}> min</Text></Text>
        <Pressable onPress={() => setMinutes(minutes + 1)} style={ui.closeBtn} accessibilityLabel="One minute more"><Icon name="plus" color={C.ink} /></Pressable>
      </View>
      <Chips label="How did that feel?" value={effort} onChange={setEffort} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Solid' }, { value: '3', label: 'Tough' }]} />
      {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
      <View style={{ flex: 1 }} />
      <Button title="Save" onPress={save} busy={busy} />
      <Button title="Discard" kind="ghost" onPress={() => Alert.alert('Discard this session?', 'Nothing gets logged.', [{ text: 'Keep', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onDone }])} />
    </View>
  );
}

function Earned({ icon, color, title, sub }: { icon: 'airplane' | 'map-marker-check' | 'fire' | 'piggy-bank'; color: string; title: string; sub?: string }) {
  return (
    <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, borderColor: tint(color, 0.4) }]}>
      <IconBadge name={icon} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={ui.rowTitle}>{title}</Text>
        {sub ? <Text style={ui.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

