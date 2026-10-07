import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { C, S, tint } from '../../lib/theme';
import { reduceMotion } from '../../lib/motion';
import { Button, Icon, styles as ui, tap, type IconName } from '../ui';
import { Pet3D, type FetchThrow, type PetAction, type PetCare } from '../pet3d/Pet3D';
import type { Pet } from '../../lib/api';

type GameProps = { visible: boolean; pet: Pet; care?: PetCare | null; onClose: () => void; onScore: (score: number) => void };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Frame({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, paddingHorizontal: S.lg, gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h2}>{title}</Text>
          <Text style={ui.rowSub}>{sub}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close game" hitSlop={8} style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="close" color={C.sub} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

/** Score card. The best score is the one from before this round, so a new best shows as new. */
function Result({ score, max, unit, best, onAgain, onDone }: { score: number; max?: number; unit: string; best: number; onAgain: () => void; onDone: () => void }) {
  const great = max ? score >= max * 0.6 : score >= 15;
  return (
    <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingVertical: S.xl }]}>
      <Icon name={great ? 'trophy' : 'paw'} size={42} color={great ? C.gold : C.accent} />
      <Text style={ui.h1}>{score}{max ? ` / ${max}` : ''}</Text>
      <Text style={{ color: C.sub }}>{unit}{score > best ? '. New best!' : best ? `. Best: ${best}` : ''}</Text>
      <View style={{ flexDirection: 'row', gap: S.sm, alignSelf: 'stretch', marginTop: S.md }}>
        <View style={{ flex: 1 }}><Button title="Play again" onPress={onAgain} /></View>
        <View style={{ flex: 1 }}><Button title="Done" kind="soft" onPress={onDone} /></View>
      </View>
    </View>
  );
}

/** Fetch: stop the marker in the green zone and the dog leaps to catch the ball. Five throws. */
export function FetchGame({ visible, pet, onClose, onScore }: GameProps) {
  const THROWS = 5;
  const [throwN, setThrowN] = useState(0);
  const [caught, setCaught] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('Tap Throw when the marker is in the green.');
  const [shot, setShot] = useState<FetchThrow | null>(null);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(pet.best.fetch);
  const power = useRef(new Animated.Value(0)).current;
  const powerNow = useRef(0);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const caughtRef = useRef(0);
  const throwRef = useRef(0);
  const [barW, setBarW] = useState(useWindowDimensions().width - S.lg * 2);
  const zone = { from: 0.62, to: 0.8 };

  useEffect(() => {
    const id = power.addListener(({ value }) => { powerNow.current = value; });
    return () => power.removeListener(id);
  }, [power]);
  useEffect(() => {
    if (!visible || busy || done) return;
    // Speeds up a little each throw.
    const speed = 1100 - throwN * 110;
    power.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(power, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(power, { toValue: 0, duration: speed, easing: Easing.linear, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, busy, done, throwN, power]);

  const clearSafety = () => { if (safety.current) clearTimeout(safety.current); safety.current = null; };
  const reset = () => {
    clearSafety();
    caughtRef.current = 0;
    throwRef.current = 0;
    setThrowN(0); setCaught(0); setBusy(false); setDone(false); setShot(null); setBest(pet.best.fetch);
    setMsg('Tap Throw when the marker is in the green.');
  };
  useEffect(() => { if (visible) reset(); else clearSafety(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible]);
  useEffect(() => clearSafety, []);

  const fetched = (wasCaught: boolean) => {
    if (!safety.current) return; // already counted
    clearSafety();
    if (wasCaught) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); caughtRef.current += 1; setCaught(caughtRef.current); }
    setMsg(wasCaught ? `${pet.name ?? 'Your dog'} caught it mid air!` : `${pet.name ?? 'Your dog'} brought it back.`);
    throwRef.current += 1;
    setThrowN(throwRef.current);
    if (throwRef.current >= THROWS) { setDone(true); onScore(caughtRef.current); }
    setBusy(false);
  };
  const doThrow = () => {
    if (busy || done) return;
    tap();
    const pw = powerNow.current;
    const perfect = pw >= zone.from && pw <= zone.to;
    setBusy(true);
    setMsg(perfect ? 'Perfect throw!' : pw < zone.from ? 'A little short. Off it goes!' : 'Big throw! Off it goes!');
    setShot({ id: Date.now(), power: pw, perfect });
    // If the 3D view is unavailable or paused, the throw still finishes.
    safety.current = setTimeout(() => fetched(perfect), 7000);
  };

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Fetch" sub={`Throw ${Math.min(throwN + 1, THROWS)} of ${THROWS} · ${caught} caught`} onClose={onClose}>
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: tint(C.green, 0.08), alignItems: 'center', justifyContent: 'center' }}>
          {visible ? <Pet3D color={pet.color} mood="thrilled" stage={pet.stage} wearing={pet.wearing} size={barW} height={400} wide sleepy={false}
            fetchThrow={shot} onFetchDone={fetched} interactive={false} /> : null}
        </View>
        {done ? (
          <Result score={caught} max={THROWS} unit="catches" best={best} onAgain={reset} onDone={onClose} />
        ) : (
          <>
            <Text style={{ color: C.ink, textAlign: 'center', fontWeight: '700' }} accessibilityLiveRegion="polite">{msg}</Text>
            <View onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)} style={{ height: 30, borderRadius: 15, backgroundColor: C.raised, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: barW * zone.from, width: barW * (zone.to - zone.from), top: 0, bottom: 0, backgroundColor: tint(C.green, 0.55) }} />
              <Animated.View style={{ position: 'absolute', top: 2, bottom: 2, width: 8, borderRadius: 4, backgroundColor: C.ink,
                transform: [{ translateX: power.interpolate({ inputRange: [0, 1], outputRange: [-4, barW - 4] }) }] }} />
            </View>
            <Button title={busy ? `${pet.name ?? 'Your dog'} is fetching` : 'Throw'} icon="tennis-ball" onPress={doThrow} busy={busy} />
          </>
        )}
      </Frame>
    </Modal>
  );
}

type Drop = { id: number; x: number; y: number; kind: 'bone' | 'ball' | 'bath'; speed: number };
const DROP_ICON: Record<Drop['kind'], { icon: IconName; color: string; points: number }> = {
  bone: { icon: 'bone', color: '#F4E9D6', points: 1 },
  ball: { icon: 'tennis-ball', color: '#C7E04A', points: 3 },
  bath: { icon: 'shower-head', color: '#8EC5FF', points: -2 },
};
const DROP = 36;
const BOWL = 84;
const CATCH_SECONDS = 30;

/** Treat catch: slide the bowl to catch falling bones and balls, dodge bath time. Thirty seconds. */
export function CatchGame({ visible, pet, onClose, onScore }: GameProps) {
  const { width } = useWindowDimensions();
  const area = useRef({ w: width - S.lg * 2, h: 420 });
  const [, setFrame] = useState(0);
  const [state, setState] = useState<'ready' | 'play' | 'done'>('ready');
  const [best, setBest] = useState(pet.best.catch);
  const g = useRef({ drops: [] as Drop[], score: 0, left: CATCH_SECONDS, flash: null as null | { text: string; until: number }, bowlX: 0, nextId: 1 });
  const startX = useRef(0);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startX.current = g.current.bowlX; },
    onPanResponderMove: (_e, gs) => {
      g.current.bowlX = Math.max(0, Math.min(area.current.w - BOWL, startX.current + gs.dx));
      setFrame((f) => f + 1);
    },
    onPanResponderTerminationRequest: () => false,
  })).current;

  const reset = () => {
    g.current = { drops: [], score: 0, left: CATCH_SECONDS, flash: null, bowlX: area.current.w / 2 - BOWL / 2, nextId: 1 };
    setFrame((f) => f + 1);
  };
  useEffect(() => { if (visible) { reset(); setState('ready'); setBest(pet.best.catch); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible]);

  // One game loop. Everything moves in a ref and the screen redraws each tick, so nothing is counted twice.
  useEffect(() => {
    if (state !== 'play' || !visible) return;
    const startAt = Date.now();
    let last = startAt;
    let spawn = 0;
    const t = setInterval(() => {
      const nowMs = Date.now();
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const elapsed = (nowMs - startAt) / 1000;
      const s = g.current;
      const { w, h } = area.current;
      s.left = Math.max(0, CATCH_SECONDS - Math.floor(elapsed));
      if (elapsed >= CATCH_SECONDS) {
        clearInterval(t);
        setState('done');
        onScore(s.score);
        return;
      }
      spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.35, 0.9 - elapsed * 0.018);
        const roll = Math.random();
        const kind: Drop['kind'] = roll < 0.18 ? 'bath' : roll < 0.3 ? 'ball' : 'bone';
        s.drops.push({ id: s.nextId++, x: Math.random() * (w - DROP), y: -DROP, kind, speed: (h / 2.6) + elapsed * 6 + Math.random() * 60 });
      }
      const bowlTop = h - BOWL * 0.85;
      let pts = 0;
      s.drops = s.drops.filter((d) => {
        d.y += d.speed * dt;
        const hit = d.y + DROP >= bowlTop + 6 && d.y <= bowlTop + 30 && d.x + DROP - 6 > s.bowlX && d.x + 6 < s.bowlX + BOWL;
        if (hit) pts += DROP_ICON[d.kind].points;
        return !hit && d.y < h;
      });
      if (pts) {
        s.score = Math.max(0, s.score + pts);
        s.flash = { text: pts > 0 ? `+${pts}` : `${pts}`, until: nowMs + 500 };
        Haptics.impactAsync(pts > 0 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      }
      if (s.flash && s.flash.until < nowMs) s.flash = null;
      setFrame((f) => f + 1);
    }, 33);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    area.current = { w, h };
    g.current.bowlX = Math.max(0, Math.min(w - BOWL, g.current.bowlX || w / 2 - BOWL / 2));
    setFrame((f) => f + 1);
  };
  const s = g.current;
  const h = area.current.h;

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Treat catch" sub={state === 'play' ? `${s.left}s left · ${s.score} points` : 'Slide the bowl. Bones 1, balls 3, avoid bath time.'} onClose={onClose}>
        {state === 'done' ? (
          <Result score={s.score} unit="points" best={best} onAgain={() => { setBest(Math.max(best, s.score)); reset(); setState('play'); }} onDone={onClose} />
        ) : (
          <View onLayout={onLayout} style={{ flex: 1, borderRadius: 20, backgroundColor: tint(C.accent, 0.08), overflow: 'hidden' }} {...pan.panHandlers}>
            {s.drops.map((d) => (
              <View key={d.id} pointerEvents="none" style={{ position: 'absolute', left: d.x, top: d.y }}>
                <Icon name={DROP_ICON[d.kind].icon} size={DROP} color={DROP_ICON[d.kind].color} />
              </View>
            ))}
            {s.flash ? <Text pointerEvents="none" style={{ position: 'absolute', left: s.bowlX + 24, top: h - BOWL - 50, color: s.flash.text.startsWith('+') ? C.green : C.danger, fontWeight: '800', fontSize: 24 }}>{s.flash.text}</Text> : null}
            <View pointerEvents="none" style={{ position: 'absolute', left: s.bowlX, top: h - BOWL, width: BOWL, alignItems: 'center' }}>
              <Icon name="bowl" size={BOWL} color={pet.color} />
            </View>
            {state === 'ready' ? (
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md }}>
                <Text style={{ color: C.ink, fontSize: 16, textAlign: 'center' }}>Drag anywhere to slide the bowl.</Text>
                <Button title="Start" icon="play" onPress={() => { tap(); reset(); setState('play'); }} />
              </View>
            ) : null}
          </View>
        )}
      </Frame>
    </Modal>
  );
}

/** An upside down cup drawn with plain shapes, solid so the bone under it never peeks out. */
function Cup({ color }: { color: string }) {
  return (
    <View style={{ width: 92, height: 80, alignItems: 'center' }}>
      <View style={{ width: 22, height: 12, borderRadius: 6, backgroundColor: tint(color, 0.8) }} />
      <View style={{ width: 78, height: 58, borderTopLeftRadius: 34, borderTopRightRadius: 34, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: color, marginTop: -2 }} />
      <View style={{ width: 92, height: 12, borderRadius: 6, backgroundColor: tint(color, 0.8), marginTop: -4 }} />
    </View>
  );
}

/** Find the bone: watch which cup hides the bone, follow the shuffle, pick the right one. Five rounds. */
export function FindGame({ visible, pet, onClose, onScore }: GameProps) {
  const ROUNDS = 5;
  const [w, setW] = useState(useWindowDimensions().width - S.lg * 2);
  const slotW = w / 3;
  const slotX = (i: number) => i * slotW + slotW / 2 - 46;
  const xs = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const lifts = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const slots = useRef([0, 1, 2]); // which slot each cup sits in
  const run = useRef(0); // bumps on close, so a shuffle in progress stops
  const [boneCup, setBoneCup] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(pet.best.find);
  const [phase, setPhase] = useState<'ready' | 'show' | 'shuffle' | 'pick' | 'reveal' | 'done'>('ready');
  const [msg, setMsg] = useState('Watch the bone, then pick the cup.');

  const resetPositions = () => { slots.current = [0, 1, 2]; xs.forEach((v, i) => v.setValue(slotX(i))); lifts.forEach((v) => v.setValue(0)); };
  const restart = () => { run.current++; setRound(0); setScore(0); setPhase('ready'); setMsg('Watch the bone, then pick the cup.'); resetPositions(); };
  useEffect(() => { if (visible) { restart(); setBest(pet.best.find); } else run.current++; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible]);
  useEffect(() => { if (phase === 'ready' || phase === 'pick' || phase === 'done') resetPositionsKeepOrder(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [w]);
  const resetPositionsKeepOrder = () => xs.forEach((v, i) => v.setValue(slotX(slots.current[i])));

  const anim = (a: Animated.CompositeAnimation) => new Promise<void>((res) => a.start(() => res()));
  const lift = (i: number, up: boolean) => anim(Animated.timing(lifts[i], { toValue: up ? 1 : 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }));

  const play = async () => {
    tap();
    const id = ++run.current;
    const live = () => run.current === id;
    const b = Math.floor(Math.random() * 3);
    setBoneCup(b);
    setPhase('show');
    setMsg('The bone is under this one…');
    await lift(b, true);
    await wait(800);
    if (!live()) return;
    await lift(b, false);
    if (!live()) return;
    setPhase('shuffle');
    setMsg('Shuffling…');
    const swaps = 4 + round * 2;
    const speed = Math.max(180, 400 - round * 45);
    for (let s = 0; s < swaps; s++) {
      if (!live()) return;
      const a = Math.floor(Math.random() * 3);
      const c = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      const sa = slots.current[a];
      slots.current[a] = slots.current[c];
      slots.current[c] = sa;
      await anim(Animated.parallel([
        Animated.timing(xs[a], { toValue: slotX(slots.current[a]), duration: speed, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(xs[c], { toValue: slotX(slots.current[c]), duration: speed, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
    }
    if (!live()) return;
    setPhase('pick');
    setMsg('Where is the bone?');
  };

  const pick = async (i: number) => {
    if (phase !== 'pick') return;
    const id = run.current;
    setPhase('reveal');
    const right = i === boneCup;
    const total = score + (right ? 1 : 0);
    setScore(total);
    if (right) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setMsg(right ? 'Found it!' : 'Not that one. Here it is.');
    await lift(i, true);
    if (!right) await lift(boneCup, true);
    await wait(900);
    if (run.current !== id) return;
    await Promise.all([lift(i, false), lift(boneCup, false)]);
    const next = round + 1;
    setRound(next);
    if (next >= ROUNDS) { setPhase('done'); onScore(total); }
    else { setPhase('ready'); setMsg(`Round ${next + 1} of ${ROUNDS}. It gets faster.`); }
  };

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Find the bone" sub={`Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS} · ${score} found`} onClose={onClose}>
        {phase === 'done' ? (
          <Result score={score} max={ROUNDS} unit="bones found" best={best} onAgain={() => { setBest(Math.max(best, score)); restart(); }} onDone={onClose} />
        ) : (
          <>
            <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 280, borderRadius: 20, backgroundColor: tint(C.gold, 0.08) }}>
              {[0, 1, 2].map((i) => (
                // Each cup carries its own spot on the floor, so the bone moves with the cup and stays hidden until it lifts.
                <Animated.View key={i} style={{ position: 'absolute', top: 110, width: 92, height: 120, transform: [{ translateX: xs[i] }] }}>
                  <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center', opacity: i === boneCup ? 1 : 0 }}>
                    <Icon name="bone" size={44} color="#F4E9D6" />
                  </View>
                  <Animated.View style={{ position: 'absolute', bottom: 8, transform: [{ translateY: lifts[i].interpolate({ inputRange: [0, 1], outputRange: [0, -90] }) }] }}>
                    <Pressable onPress={() => pick(i)} disabled={phase !== 'pick'} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Cup ${i + 1}`}>
                      <Cup color={pet.color} />
                    </Pressable>
                  </Animated.View>
                </Animated.View>
              ))}
            </View>
            <Text style={{ color: C.ink, textAlign: 'center', fontWeight: '700', fontSize: 16 }} accessibilityLiveRegion="polite">{msg}</Text>
            {phase === 'ready' ? <Button title={round ? 'Next round' : 'Start'} icon="play" onPress={play} /> : null}
          </>
        )}
      </Frame>
    </Modal>
  );
}

/** Bath time: scrub the dog all over until the foam covers it, then it shakes off. */
export function BathGame({ visible, pet, care, onClose, onScore }: GameProps) {
  const { width } = useWindowDimensions();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'scrub' | 'shake' | 'done'>('scrub');
  const [action, setAction] = useState<PetAction | null>(null);
  const dist = useRef(0);
  const last = useRef({ x: 0, y: 0 });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const NEEDED = 5000; // finger travel in points

  useEffect(() => { if (visible) { dist.current = 0; setProgress(0); setPhase('scrub'); setAction(null); } }, [visible]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_e, g) => { last.current = { x: g.dx, y: g.dy }; },
    onPanResponderMove: (_e, g) => {
      if (phaseRef.current !== 'scrub') return;
      const d = Math.hypot(g.dx - last.current.x, g.dy - last.current.y);
      last.current = { x: g.dx, y: g.dy };
      const before = Math.floor((dist.current / NEEDED) * 10);
      dist.current += d;
      const p = Math.min(1, dist.current / NEEDED);
      if (Math.floor(p * 10) > before) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      setProgress(p);
    },
    onPanResponderTerminationRequest: () => false,
  })).current;

  useEffect(() => {
    if (progress < 1 || phase !== 'scrub') return;
    setPhase('shake');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    (async () => {
      await wait(500);
      setAction({ name: 'shake', id: Date.now() });
      await wait(1700);
      setPhase('done');
      onScore(100);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, phase]);

  const dirt = (care?.dirt ?? 0.6) * (1 - progress);
  const foam = phase === 'scrub' ? Math.min(1, progress * 1.15) : phase === 'shake' ? 0.5 : 0;
  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Bath time" sub={phase === 'done' ? 'Squeaky clean' : 'Rub all over the dog to scrub'} onClose={onClose}>
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: tint('#8EC5FF', 0.14), alignItems: 'center', justifyContent: 'center' }} {...pan.panHandlers}>
          {visible ? <Pet3D color={pet.color} mood={phase === 'done' ? 'thrilled' : 'okay'} stage={pet.stage} wearing={null} size={width - S.lg * 2} height={380} sleepy={false}
            interactive={false} action={action} bubbles={foam} care={{ dirt, mess: 0, tired: false, sick: false, napping: false }} /> : null}
        </View>
        {phase === 'done' ? (
          <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingVertical: S.lg }]}>
            <Icon name="shimmer" size={38} color={C.accent} />
            <Text style={ui.h2}>All clean!</Text>
            <View style={{ alignSelf: 'stretch' }}><Button title="Done" onPress={onClose} /></View>
          </View>
        ) : (
          <View style={{ gap: S.sm }}>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: C.raised, overflow: 'hidden' }}>
              <View style={{ height: 12, width: `${Math.round(progress * 100)}%`, backgroundColor: '#8EC5FF' }} />
            </View>
            <Text style={{ color: C.sub, textAlign: 'center' }} accessibilityLiveRegion="polite">{phase === 'shake' ? 'Shake it off!' : `Scrubbed ${Math.round(progress * 100)}%`}</Text>
          </View>
        )}
      </Frame>
    </Modal>
  );
}
