import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { reduceMotion } from '../lib/motion';
import type { Mood, PetKind } from '../lib/api';

export const PET_COLORS = [
  { value: '#F2C96B', label: 'Honey' },
  { value: '#F59AB8', label: 'Blossom' },
  { value: '#8FD3B6', label: 'Mint' },
  { value: '#C8A27A', label: 'Toffee' },
  { value: '#B8B6D9', label: 'Lavender' },
  { value: '#F4EFE6', label: 'Cream' },
];
export const PET_KINDS: { value: PetKind; label: string }[] = [
  { value: 'cat', label: 'Cat' },
  { value: 'dog', label: 'Dog' },
  { value: 'bunny', label: 'Bunny' },
  { value: 'bear', label: 'Bear' },
];

/** Lightens (positive) or darkens (negative) a #RRGGBB colour. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const INK = '#2B2340';
const PINK = '#F7A1B5';
const SCALE = [0.72, 0.84, 0.94, 1, 1];

/** The shared pet, drawn in code. Grows with each stage, wears a scarf and later a crown, and shows its mood. */
export function PetArt({ kind, color, mood, stage, size = 200 }: { kind: PetKind; color: string; mood: Mood; stage: number; size?: number }) {
  const dark = shade(color, -0.22);
  const light = shade(color, 0.45);
  const sc = SCALE[Math.min(stage, SCALE.length - 1)];
  const happy = mood === 'thrilled' || mood === 'happy';
  const sad = mood === 'sad';

  const ears = (() => {
    switch (kind) {
      case 'dog':
        return (
          <>
            <Ellipse cx={40} cy={108} rx={16} ry={34} fill={dark} transform="rotate(28 40 108)" />
            <Ellipse cx={160} cy={108} rx={16} ry={34} fill={dark} transform="rotate(-28 160 108)" />
          </>
        );
      case 'bunny':
        return (
          <>
            <Ellipse cx={78} cy={48} rx={13} ry={40} fill={color} transform="rotate(-10 78 48)" />
            <Ellipse cx={78} cy={52} rx={6} ry={28} fill={PINK} transform="rotate(-10 78 52)" />
            <Ellipse cx={122} cy={48} rx={13} ry={40} fill={color} transform="rotate(10 122 48)" />
            <Ellipse cx={122} cy={52} rx={6} ry={28} fill={PINK} transform="rotate(10 122 52)" />
          </>
        );
      case 'bear':
        return (
          <>
            <Circle cx={58} cy={80} r={19} fill={color} />
            <Circle cx={58} cy={80} r={10} fill={dark} />
            <Circle cx={142} cy={80} r={19} fill={color} />
            <Circle cx={142} cy={80} r={10} fill={dark} />
          </>
        );
      default:
        return (
          <>
            <Path d="M52 92 L62 42 L96 72 Z" fill={color} />
            <Path d="M60 84 L65 56 L86 74 Z" fill={PINK} />
            <Path d="M148 92 L138 42 L104 72 Z" fill={color} />
            <Path d="M140 84 L135 56 L114 74 Z" fill={PINK} />
          </>
        );
    }
  })();

  const eyes = happy ? (
    <>
      <Path d="M70 118 Q78 106 86 118" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M114 118 Q122 106 130 118" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
    </>
  ) : sad ? (
    <>
      <Circle cx={78} cy={120} r={6} fill={INK} />
      <Circle cx={122} cy={120} r={6} fill={INK} />
      <Path d="M68 112 L86 105" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <Path d="M132 112 L114 105" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <Ellipse cx={86} cy={133} rx={3} ry={5} fill="#8EC5FF" />
    </>
  ) : (
    <>
      <Circle cx={78} cy={117} r={7} fill={INK} />
      <Circle cx={80.5} cy={114.5} r={2.4} fill="#FFFFFF" />
      <Circle cx={122} cy={117} r={7} fill={INK} />
      <Circle cx={124.5} cy={114.5} r={2.4} fill="#FFFFFF" />
    </>
  );

  const mouth = mood === 'thrilled'
    ? <Path d="M90 134 Q100 150 110 134 Z" fill={INK} />
    : happy || mood === 'new'
      ? <Path d="M91 135 Q100 144 109 135" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
      : sad
        ? <Path d="M92 143 Q100 135 108 143" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
        : <Path d="M93 138 L107 138" stroke={INK} strokeWidth={4} strokeLinecap="round" />;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Ellipse cx={100} cy={186} rx={56 * sc} ry={8} fill="#000000" opacity={0.18} />
      <G transform={`translate(${100 - 100 * sc} ${186 - 186 * sc}) scale(${sc})`}>
        {ears}
        <Ellipse cx={100} cy={128} rx={66} ry={58} fill={color} />
        <Ellipse cx={100} cy={150} rx={40} ry={30} fill={light} opacity={0.7} />
        {kind === 'dog' || kind === 'bear' ? <Ellipse cx={100} cy={136} rx={20} ry={14} fill={light} /> : null}
        <Ellipse cx={100} cy={128} rx={6} ry={4.5} fill={kind === 'cat' || kind === 'bunny' ? PINK : INK} />
        {eyes}
        {mouth}
        {happy ? (
          <>
            <Ellipse cx={64} cy={136} rx={9} ry={5} fill={PINK} opacity={0.7} />
            <Ellipse cx={136} cy={136} rx={9} ry={5} fill={PINK} opacity={0.7} />
          </>
        ) : null}
        {kind === 'cat' ? (
          <>
            <Path d="M58 130 L36 126 M58 136 L36 140" stroke={dark} strokeWidth={2} strokeLinecap="round" />
            <Path d="M142 130 L164 126 M142 136 L164 140" stroke={dark} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        <Ellipse cx={76} cy={182} rx={14} ry={7} fill={dark} />
        <Ellipse cx={124} cy={182} rx={14} ry={7} fill={dark} />
        {stage >= 3 ? (
          <>
            <Path d="M42 158 Q100 182 158 158 L156 170 Q100 194 44 170 Z" fill="#1F8A62" />
            <Rect x={124} y={168} width={14} height={26} rx={4} fill="#1F8A62" transform="rotate(-12 131 181)" />
          </>
        ) : null}
        {stage >= 4 ? (
          <>
            <Path d="M74 74 L78 48 L90 62 L100 42 L110 62 L122 48 L126 74 Z" fill="#F2C96B" stroke="#C9972B" strokeWidth={2} strokeLinejoin="round" />
            <Circle cx={100} cy={62} r={4} fill="#E2557B" />
          </>
        ) : null}
      </G>
    </Svg>
  );
}

/** The pet with gentle movement: bounces when happy, sways slowly when sad, jumps when tapped. */
export function Pet({ kind, color, mood, stage, size = 200, onTap }: {
  kind: PetKind; color: string; mood: Mood; stage: number; size?: number; onTap?: () => void;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const hearts = useRef(new Animated.Value(0)).current;
  const still = reduceMotion();

  useEffect(() => {
    if (still) return;
    const speed = mood === 'thrilled' ? 700 : mood === 'happy' ? 1000 : mood === 'sad' ? 2400 : 1500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    let heartLoop: Animated.CompositeAnimation | null = null;
    if (mood === 'thrilled') {
      heartLoop = Animated.loop(Animated.timing(hearts, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
      heartLoop.start();
    }
    return () => { loop.stop(); heartLoop?.stop(); };
  }, [mood, still, bob, hearts]);

  const tap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (!still) {
      jump.setValue(0);
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(jump, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    onTap?.();
  };

  const amp = mood === 'thrilled' ? 8 : mood === 'happy' ? 5 : mood === 'sad' ? 2 : 3;
  return (
    <Pressable onPress={tap} accessibilityRole="button" accessibilityLabel="Your pet. Tap to say hello.">
      <View style={{ width: size, height: size }}>
        {mood === 'thrilled' && !still ? (
          <Animated.Text style={{
            position: 'absolute', right: size * 0.12, top: size * 0.1, fontSize: size * 0.11,
            opacity: hearts.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateY: hearts.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.25] }) }],
          }}>♥</Animated.Text>
        ) : null}
        <Animated.View style={{
          transform: [
            { translateY: Animated.add(bob.interpolate({ inputRange: [0, 1], outputRange: [0, -amp] }), jump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.12] })) },
            { rotate: mood === 'sad' ? bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) : '0deg' },
          ],
        }}>
          <PetArt kind={kind} color={color} mood={mood} stage={stage} size={size} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** What the pet says, based on who has moved today. */
export function petLine(o: { name: string; mood: Mood; meName: string; partnerName: string | null; meFed: boolean; partnerFed: boolean; hour: number }) {
  if (o.mood === 'new') return `Hi, I'm ${o.name}! A ten minute walk is all I need.`;
  if (o.meFed && (o.partnerFed || !o.partnerName)) return o.mood === 'thrilled' ? 'Best day ever. You both moved today!' : 'All fed. Thank you both!';
  if (o.meFed && o.partnerName) return `Thanks ${o.meName}! Waiting on ${o.partnerName}.`;
  if (o.partnerFed && o.partnerName) return `${o.partnerName} took me out. Your turn?`;
  if (o.mood === 'sad') return 'I miss our walks. Ten minutes?';
  if (o.hour < 12) return 'Morning! Walk me?';
  if (o.hour < 17) return 'Is it walk time yet?';
  return 'Ten minutes before dinner?';
}
