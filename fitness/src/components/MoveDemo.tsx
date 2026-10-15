// Shows how an exercise is done: start and end photos that swap back and forth, or a moving stick figure.
// A "How to" sheet adds step by step instructions and the muscles worked.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { C, S, tint } from '../lib/theme';
import { photoInfo, photosFor, type PhotoInfo } from '../lib/howto';
import { blend, FIGURES, joints, type Figure } from '../lib/figures';
import { byId } from '../lib/exercises';
import { moveById, type Move } from '../lib/lifts';
import { reduceMotion } from '../lib/motion';
import { Icon, styles as ui } from './ui';

/** True when there is a picture of some kind for this exercise. */
export const hasDemo = (moveId: string) => !!photosFor(moveId) || !!FIGURES[moveId];

/** The moving picture for an exercise, or nothing when there is none. */
export function MoveDemo({ moveId, width, height }: { moveId: string; width: number; height: number }) {
  const photos = photosFor(moveId);
  if (photos) return <PhotoPair uris={photos} width={width} height={height} />;
  const fig = FIGURES[moveId];
  if (fig) return <StickFigure fig={fig} width={width} height={height} />;
  return null;
}

function PhotoPair({ uris, width, height }: { uris: string[]; width: number; height: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(fade, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(fade, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [fade]);
  if (failed) return null;
  const style = { position: 'absolute' as const, left: 0, top: 0, width, height, borderRadius: 14 };
  return (
    <View style={{ width, height, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff' }} accessibilityLabel="Photos of the start and end position">
      <Image source={{ uri: uris[0] }} style={style} resizeMode="contain" onError={() => setFailed(true)} />
      <Animated.Image source={{ uri: uris[1] }} style={[style, { opacity: fade }]} resizeMode="contain" />
    </View>
  );
}

/** A simple figure moving between its poses. */
export function StickFigure({ fig, width, height }: { fig: Figure; width: number; height: number }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (reduceMotion() || fig.frames.length < 2) return;
    const start = Date.now();
    const per = (fig.secs ?? 1.8) * 1000; // time from one pose to the next
    const t = setInterval(() => setK(((Date.now() - start) / per) % fig.frames.length), 40);
    return () => clearInterval(t);
  }, [fig]);
  const i = Math.floor(k);
  const f = k - i;
  // Ease in and out, with a short hold at each pose.
  const e = f < 0.25 ? 0 : f > 0.85 ? 1 : (1 - Math.cos(((f - 0.25) / 0.6) * Math.PI)) / 2;
  const a = fig.frames[i % fig.frames.length];
  const b = fig.frames[(i + 1) % fig.frames.length];
  const j = joints(blend(a, b, e));
  const pts = (arr: [number, number][]) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const ink = C.accent;
  const far = tint(C.accent, 0.45);
  const seat = joints(fig.frames[0]).hip;
  return (
    <View style={{ width, height, borderRadius: 14, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Drawing of the movement">
      <Svg width={width} height={height} viewBox="8 4 104 100">
        <Line x1={4} y1={100.5} x2={116} y2={100.5} stroke={C.line} strokeWidth={1.2} />
        {fig.prop === 'mat' || fig.prop === 'partner' ? <Rect x={12} y={99} width={96} height={3} rx={1.5} fill={tint(C.green, 0.35)} /> : null}
        {fig.prop === 'chair' ? (
          <>
            <Rect x={seat[0] - 12} y={seat[1] + 1} width={16} height={2.5} rx={1} fill={C.faint} />
            <Line x1={seat[0] - 11} y1={seat[1] + 3} x2={seat[0] - 11} y2={100} stroke={C.faint} strokeWidth={1.6} />
            <Line x1={seat[0] + 3} y1={seat[1] + 3} x2={seat[0] + 3} y2={100} stroke={C.faint} strokeWidth={1.6} />
            <Line x1={seat[0] - 11} y1={seat[1] + 1} x2={seat[0] - 13} y2={seat[1] - 26} stroke={C.faint} strokeWidth={1.6} />
          </>
        ) : null}
        {fig.prop === 'wall' ? <Rect x={seat[0] - 9} y={20} width={3} height={81} fill={C.faint} /> : null}
        {fig.prop === 'step' ? <Rect x={60} y={92} width={40} height={8} rx={1} fill={C.faint} /> : null}
        <Polyline points={pts(j.la)} fill="none" stroke={far} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={pts(j.ll)} fill="none" stroke={far} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        <Line x1={j.hip[0]} y1={j.hip[1]} x2={j.neck[0]} y2={j.neck[1]} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        <Polyline points={pts(j.rl)} fill="none" stroke={ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={pts(j.ra)} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={j.head[0]} cy={j.head[1]} r={6.5} fill={C.card} stroke={ink} strokeWidth={3.5} />
      </Svg>
      {fig.prop === 'partner' ? <Text style={{ position: 'absolute', bottom: 6, right: 8, color: C.faint, fontSize: 10 }}>with your partner</Text> : null}
    </View>
  );
}

/** Full screen guide: the moving picture, steps, muscles and tips. Opens from an info button anywhere. */
export function HowTo({ move, onClose }: { move: Move | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [info, setInfo] = useState<PhotoInfo | null>(null);
  useEffect(() => { setInfo(null); if (move) photoInfo(move.id).then(setInfo); }, [move]);
  if (!move) return null;
  const home = move.id.startsWith('h-') ? byId(move.id.slice(2)) : null;
  const w = width - S.lg * 2;
  const photos = !!photosFor(move.id);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={ui.h2}>{move.name}</Text>
            <Text style={ui.rowSub}>{move.group} · {move.equip}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
            <Icon name="close" color={C.sub} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.md, paddingBottom: insets.bottom + 40 }}>
          {hasDemo(move.id) ? <MoveDemo moveId={move.id} width={w} height={photos ? w * 0.67 : w * 0.7} /> : (
            <View style={[ui.card, { alignItems: 'center', gap: S.sm }]}>
              <Icon name="human-handsup" size={40} color={C.faint} />
              <Text style={{ color: C.sub, textAlign: 'center' }}>No picture for this one yet.</Text>
            </View>
          )}
          {photos ? <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center' }}>Swaps between the start and end position</Text> : null}
          {home ? (
            <View style={[ui.card, { gap: S.sm }]}>
              <Text style={ui.label}>How to</Text>
              <Text style={{ color: C.ink, lineHeight: 22 }}>{home.how}</Text>
              {home.easier ? <Text style={{ color: C.green, lineHeight: 20 }}>Easier: {home.easier}</Text> : null}
              {home.harder ? <Text style={{ color: C.gold, lineHeight: 20 }}>Harder: {home.harder}</Text> : null}
            </View>
          ) : null}
          {info?.instructions?.length ? (
            <View style={[ui.card, { gap: S.sm }]}>
              <Text style={ui.label}>{home ? 'More detail' : 'Step by step'}</Text>
              {info.instructions.slice(0, 6).map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: S.sm }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.accent, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: C.ink, flex: 1, lineHeight: 21 }}>{s}</Text>
                </View>
              ))}
            </View>
          ) : photos && !info ? <Text style={{ color: C.sub, textAlign: 'center' }}>Loading the steps…</Text> : null}
          {info?.primaryMuscles?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[...info.primaryMuscles, ...info.secondaryMuscles].map((m, i) => (
                <View key={m} style={[ui.chip, { backgroundColor: i < info.primaryMuscles.length ? C.accentSoft : C.raised, borderColor: i < info.primaryMuscles.length ? C.accent : C.line }]}>
                  <Text style={[ui.chipText, i < info.primaryMuscles.length && { color: C.accent, fontWeight: '700' }]}>{m[0].toUpperCase() + m.slice(1)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {photos ? <Text style={{ color: C.faint, fontSize: 11, textAlign: 'center' }}>Photos and steps: Free Exercise DB, public domain</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A small "How to" button that opens the guide for an exercise id. */
export function HowToButton({ moveId, name, compact }: { moveId: string; name?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`How to do ${name ?? 'this exercise'}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.6 : 1, paddingHorizontal: compact ? 0 : 10, paddingVertical: compact ? 0 : 6, borderRadius: 10, backgroundColor: compact ? 'transparent' : C.accentSoft })}>
        <Icon name="information-outline" size={compact ? 22 : 18} color={C.accent} />
        {compact ? null : <Text style={{ color: C.accent, fontWeight: '700', fontSize: 13 }}>How to</Text>}
      </Pressable>
      {open ? <HowTo move={moveById(moveId, name)} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
