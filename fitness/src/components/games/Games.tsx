import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { C, S, tint } from '../../lib/theme';
import { reduceMotion } from '../../lib/motion';
import { Button, Icon, styles as ui, tap, type IconName } from '../ui';
import { Pet3D, type FetchThrow } from '../pet3d/Pet3D';
import type { Pet } from '../../lib/api';

type GameProps = { visible: boolean; pet: Pet; onClose: () => void; onScore: (score: number) => void };

function Frame({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + S.lg, paddingHorizontal: S.lg, gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h2}>{title}</Text>
          <Text style={ui.rowSub}>{sub}</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close game" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="close" color={C.sub} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

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

/** Fetch: stop the power bar in the green zone and the dog leaps to catch the ball. Five throws. */
export function FetchGame({ visible, pet, onClose, onScore }: GameProps) {
  const THROWS = 5;
  const [throwN, setThrowN] = useState(0);
  const [caught, setCaught] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('Tap Throw when the marker is in the green.');
  const [shot, setShot] = useState<FetchThrow | null>(null);
  const [done, setDone] = useState(false);
  const power = useRef(new Animated.Value(0)).current;
  const powerNow = useRef(0);
  const { width } = useWindowDimensions();
  const barW = width - S.lg * 2;
  const zone = { from: 0.62, to: 0.8 };

  useEffect(() => {
    const id = power.addListener(({ value }) => { powerNow.current = value; });
    return () => power.removeListener(id);
  }, [power]);
  useEffect(() => {
    if (!visible || busy || done) return;
    const speed = 1100 - throwN * 120;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(power, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(power, { toValue: 0, duration: speed, easing: Easing.linear, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, busy, done, throwN, power]);

  const reset = () => { setThrowN(0); setCaught(0); setBusy(false); setDone(false); setMsg('Tap Throw when the marker is in the green.'); };
  useEffect(() => { if (visible) reset(); }, [visible]);

  const doThrow = () => {
    if (busy) return;
    tap();
    const pw = powerNow.current;
    const perfect = pw >= zone.from && pw <= zone.to;
    setBusy(true);
    setMsg(perfect ? 'Perfect throw!' : pw < zone.from ? 'A little short. Off it goes!' : 'Big throw! Off it goes!');
    setShot({ id: Date.now(), power: pw, perfect });
  };
  const fetched = (wasCaught: boolean) => {
    if (wasCaught) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); setCaught((c) => c + 1); }
    setThrowN((n) => {
      const next = n + 1;
      if (next >= THROWS) { setDone(true); }
      return next;
    });
    setBusy(false);
    setMsg(wasCaught ? `${pet.name} caught it mid air!` : `${pet.name} brought it back.`);
  };
  useEffect(() => { if (done) onScore(caught); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [done]);

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Fetch" sub={`Throw ${Math.min(throwN + 1, THROWS)} of ${THROWS} · ${caught} caught`} onClose={onClose}>
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: tint(C.green, 0.08), alignItems: 'center', justifyContent: 'center' }}>
          {visible ? <Pet3D color={pet.color} mood="thrilled" stage={pet.stage} wearing={pet.wearing} size={width - S.lg * 2} height={420} wide sleepy={false}
            fetchThrow={shot} onFetchDone={fetched} interactive={false} /> : null}
        </View>
        {done ? (
          <Result score={caught} max={THROWS} unit="catches" best={pet.best.fetch} onAgain={reset} onDone={onClose} />
        ) : (
          <>
            <Text style={{ color: C.ink, textAlign: 'center', fontWeight: '700' }} accessibilityLiveRegion="polite">{msg}</Text>
            <View style={{ height: 28, borderRadius: 14, backgroundColor: C.raised, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', left: barW * zone.from, width: barW * (zone.to - zone.from), top: 0, bottom: 0, backgroundColor: tint(C.green, 0.55) }} />
              <Animated.View style={{ position: 'absolute', top: 2, bottom: 2, width: 8, borderRadius: 4, backgroundColor: C.ink,
                left: power.interpolate({ inputRange: [0, 1], outputRange: [0, barW - 8] }) }} />
            </View>
            <Button title={busy ? `${pet.name} is fetching…` : 'Throw'} icon="tennis-ball" onPress={doThrow} busy={busy} />
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

/** Treat catch: slide the bowl to catch falling bones and balls, dodge bath time. Thirty seconds. */
export function CatchGame({ visible, pet, onClose, onScore }: GameProps) {
  const { width } = useWindowDimensions();
  const areaW = width - S.lg * 2;
  const areaH = 460;
  const BOWL = 84;
  const [drops, setDrops] = useState<Drop[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(30);
  const [state, setState] = useState<'ready' | 'play' | 'done'>('ready');
  const [flash, setFlash] = useState<string | null>(null);
  const bowlX = useRef(areaW / 2 - BOWL / 2);
  const [bowl, setBowl] = useState(areaW / 2 - BOWL / 2);
  const startX = useRef(0);
  const nextId = useRef(1);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startX.current = bowlX.current; },
    onPanResponderMove: (_e, g) => {
      const x = Math.max(0, Math.min(areaW - BOWL, startX.current + g.dx));
      bowlX.current = x;
      setBowl(x);
    },
  })).current;

  useEffect(() => { if (visible) { setState('ready'); setScore(0); setLeft(30); setDrops([]); } }, [visible]);

  useEffect(() => {
    if (state !== 'play') return;
    const startAt = Date.now();
    let last = Date.now();
    let spawn = 0;
    const t = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      const elapsed = (now - startAt) / 1000;
      setLeft(Math.max(0, 30 - Math.floor(elapsed)));
      if (elapsed >= 30) { setState('done'); return; }
      spawn -= dt;
      setDrops((ds) => {
        let out = ds.map((d) => ({ ...d, y: d.y + d.speed * dt }));
        if (spawn <= 0) {
          spawn = Math.max(0.35, 0.9 - elapsed * 0.018);
          const roll = Math.random();
          const kind: Drop['kind'] = roll < 0.18 ? 'bath' : roll < 0.3 ? 'ball' : 'bone';
          out.push({ id: nextId.current++, x: Math.random() * (areaW - 36), y: -36, kind, speed: 170 + elapsed * 6 + Math.random() * 60 });
        }
        const caughtNow: Drop[] = [];
        out = out.filter((d) => {
          const hit = d.y + 36 >= areaH - 70 && d.y <= areaH - 40 && d.x + 36 > bowlX.current && d.x < bowlX.current + BOWL;
          if (hit) caughtNow.push(d);
          return !hit && d.y < areaH;
        });
        if (caughtNow.length) {
          const pts = caughtNow.reduce((a, d) => a + DROP_ICON[d.kind].points, 0);
          setScore((sc) => Math.max(0, sc + pts));
          setFlash(pts > 0 ? `+${pts}` : `${pts}`);
          Haptics.impactAsync(pts > 0 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
        }
        return out;
      });
    }, 33);
    return () => clearInterval(t);
  }, [state, areaW]);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 500); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (state === 'done') onScore(score); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [state]);

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Treat catch" sub={state === 'play' ? `${left}s left · ${score} points` : 'Slide the bowl. Bones 1, balls 3, avoid bath time.'} onClose={onClose}>
        {state === 'done' ? (
          <Result score={score} unit="points" best={pet.best.catch} onAgain={() => { setScore(0); setLeft(30); setDrops([]); setState('play'); }} onDone={onClose} />
        ) : (
          <View style={{ width: areaW, height: areaH, borderRadius: 20, backgroundColor: tint(C.accent, 0.08), overflow: 'hidden' }} {...pan.panHandlers}>
            {drops.map((d) => (
              <View key={d.id} style={{ position: 'absolute', left: d.x, top: d.y }}>
                <Icon name={DROP_ICON[d.kind].icon} size={36} color={DROP_ICON[d.kind].color} />
              </View>
            ))}
            {flash ? <Text style={{ position: 'absolute', left: bowl + 20, top: areaH - 120, color: flash.startsWith('+') ? C.green : C.danger, fontWeight: '800', fontSize: 24 }}>{flash}</Text> : null}
            <View style={{ position: 'absolute', left: bowl, top: areaH - 72, width: BOWL, alignItems: 'center' }}>
              <Icon name="bowl" size={BOWL} color={pet.color} />
            </View>
            {state === 'ready' ? (
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md }}>
                <Text style={{ color: C.ink, fontSize: 16, textAlign: 'center' }}>Drag anywhere to slide the bowl.</Text>
                <Button title="Start" icon="play" onPress={() => { tap(); setState('play'); }} />
              </View>
            ) : null}
          </View>
        )}
      </Frame>
    </Modal>
  );
}

/** Find the bone: watch which bowl hides the bone, follow the shuffle, pick the right one. Five rounds. */
export function FindGame({ visible, pet, onClose, onScore }: GameProps) {
  const ROUNDS = 5;
  const { width } = useWindowDimensions();
  const slotW = (width - S.lg * 2) / 3;
  const slotX = (i: number) => i * slotW + slotW / 2 - 45;
  const xs = useRef([0, 1, 2].map((i) => new Animated.Value(slotX(i)))).current;
  const lifts = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const slots = useRef([0, 1, 2]); // which slot each bowl sits in
  const [boneBowl, setBoneBowl] = useState(0);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'show' | 'shuffle' | 'pick' | 'reveal' | 'done'>('ready');
  const [msg, setMsg] = useState('Watch the bone, then pick the bowl.');

  const resetPositions = () => { slots.current = [0, 1, 2]; xs.forEach((v, i) => v.setValue(slotX(i))); lifts.forEach((v) => v.setValue(0)); };
  useEffect(() => { if (visible) { setRound(0); setScore(0); setPhase('ready'); resetPositions(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible]);

  const lift = (i: number, up: boolean) => new Promise<void>((res) => Animated.timing(lifts[i], { toValue: up ? 1 : 0, duration: 320, useNativeDriver: true }).start(() => res()));

  const play = async () => {
    tap();
    const b = Math.floor(Math.random() * 3);
    setBoneBowl(b);
    setPhase('show');
    setMsg('The bone is under this one…');
    await lift(b, true);
    await new Promise((r) => setTimeout(r, 700));
    await lift(b, false);
    setPhase('shuffle');
    setMsg('Shuffling…');
    const swaps = 4 + round * 2;
    const speed = Math.max(170, 380 - round * 45);
    for (let s = 0; s < swaps; s++) {
      const a = Math.floor(Math.random() * 3);
      const c = (a + 1 + Math.floor(Math.random() * 2)) % 3;
      const sa = slots.current[a];
      slots.current[a] = slots.current[c];
      slots.current[c] = sa;
      await new Promise<void>((res) => Animated.parallel([
        Animated.timing(xs[a], { toValue: slotX(slots.current[a]), duration: speed, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(xs[c], { toValue: slotX(slots.current[c]), duration: speed, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start(() => res()));
    }
    setPhase('pick');
    setMsg('Where is the bone?');
  };

  const pick = async (i: number) => {
    if (phase !== 'pick') return;
    setPhase('reveal');
    const right = i === boneBowl;
    if (right) { setScore((s) => s + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); }
    setMsg(right ? 'Found it!' : 'Not that one. Here it is.');
    await lift(i, true);
    if (!right) await lift(boneBowl, true);
    await new Promise((r) => setTimeout(r, 900));
    await Promise.all([lift(i, false), lift(boneBowl, false)]);
    const next = round + 1;
    setRound(next);
    if (next >= ROUNDS) { setPhase('done'); onScore(score + (right ? 1 : 0)); }
    else { setPhase('ready'); setMsg(`Round ${next + 1} of ${ROUNDS}. It gets faster.`); }
  };

  return (
    <Modal visible={visible} animationType={reduceMotion() ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Frame title="Find the bone" sub={`Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS} · ${score} found`} onClose={onClose}>
        {phase === 'done' ? (
          <Result score={score} max={ROUNDS} unit="bones found" best={pet.best.find} onAgain={() => { setRound(0); setScore(0); setPhase('ready'); resetPositions(); }} onDone={onClose} />
        ) : (
          <>
            <View style={{ height: 300, borderRadius: 20, backgroundColor: tint(C.gold, 0.08), justifyContent: 'center' }}>
              {/* Bone sits in the slot of the bowl hiding it */}
              {[0, 1, 2].map((i) => (
                <Animated.View key={`bone${i}`} style={{ position: 'absolute', top: 175, transform: [{ translateX: Animated.add(xs[i], new Animated.Value(22)) }], opacity: i === boneBowl ? 1 : 0 }}>
                  <Icon name="bone" size={46} color="#F4E9D6" />
                </Animated.View>
              ))}
              {[0, 1, 2].map((i) => (
                <Animated.View key={i} style={{ position: 'absolute', top: 120, transform: [{ translateX: xs[i] }, { translateY: lifts[i].interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) }] }}>
                  <Pressable onPress={() => pick(i)} disabled={phase !== 'pick'} accessibilityRole="button" accessibilityLabel={`Bowl ${i + 1}`}>
                    <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="bowl" size={90} color={pet.color} /></View>
                  </Pressable>
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
