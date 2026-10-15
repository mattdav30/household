// The way into the GPS tracker. Shows a live walk in progress so it is easy to get back to.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C, S, tint } from '../lib/theme';
import { currentTrack, fmtKm, fmtTime, onTrack, statsOf } from '../lib/gps';
import { useStore } from '../lib/store';
import { Icon, styles as ui, tap } from './ui';

export function TrackCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { summary } = useStore();
  const [, setTick] = useState(0);
  const tr = currentTrack();
  useEffect(() => {
    const off = onTrack(() => setTick((n) => n + 1));
    const t = tr ? setInterval(() => setTick((n) => n + 1), 1000) : null;
    return () => { off(); if (t) clearInterval(t); };
  }, [tr]);
  const open = () => { tap(); router.push('/track'); };
  const km = summary ? Object.values(summary.week.km_by_user ?? {}).reduce((a, b) => a + b, 0) : 0;

  if (tr) {
    const st = statsOf(tr);
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Back to the tracker"
        style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: tint(C.green, 0.14), borderColor: C.green, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="crosshairs-gps" size={26} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>{tr.pausedAt ? 'PAUSED' : `TRACKING YOUR ${tr.kind.toUpperCase()}`}</Text>
          <Text style={[ui.rowTitle, ui.num]}>{fmtKm(st.distance)} km · {fmtTime(st.activeMs)}</Text>
        </View>
        <Icon name="chevron-right" size={22} color={C.green} />
      </Pressable>
    );
  }
  if (compact) {
    return (
      <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1, borderColor: tint(C.green, 0.6), opacity: pressed ? 0.7 : 1 })}>
        <Icon name="map-marker-path" size={20} color={C.green} />
        <Text style={{ color: C.green, fontWeight: '800', fontSize: 15 }}>Track a walk or run with GPS</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} accessibilityRole="button"
      style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: tint(C.green, 0.18), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="map-marker-path" size={24} color={C.green} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ui.rowTitle}>Walk or run with GPS</Text>
        <Text style={ui.rowSub}>{km ? `${km.toFixed(1)} km tracked this week` : 'Map your route, pace and kilometre splits'}</Text>
      </View>
      <Icon name="play-circle" size={30} color={C.green} />
    </Pressable>
  );
}
