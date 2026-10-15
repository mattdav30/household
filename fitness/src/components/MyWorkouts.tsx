// Your own workouts on the Workouts tab: start one, build one, or pick up where you left off.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, changes } from '../lib/api';
import { useStore } from '../lib/store';
import { C, S, tint } from '../lib/theme';
import { fmtTime } from '../lib/gps';
import { loadLift, type Template } from '../lib/strength';
import { Icon, SectionTitle, styles as ui, tap } from './ui';

export function MyWorkouts() {
  const router = useRouter();
  const { name, summary } = useStore();
  const [list, setList] = useState<Template[] | null>(null);
  const [, setTick] = useState(0);
  const load = useCallback(() => { api<Template[]>('/api/fit/templates').then(setList).catch(() => setList([])); }, []);
  useEffect(() => { load(); return changes.on(load); }, [load]);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));
  const going = loadLift();

  return (
    <View style={{ gap: S.sm }}>
      <SectionTitle right={<Pressable onPress={() => { tap(); router.push('/lifts'); }} accessibilityRole="button"><Text style={{ color: C.accent, fontWeight: '700' }}>Personal bests</Text></Pressable>}>Your workouts</SectionTitle>
      {going ? (
        <Pressable onPress={() => { tap(); router.push('/lift'); }} accessibilityRole="button"
          style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: tint(C.green, 0.14), borderColor: C.green, opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="weight-lifter" size={26} color={C.green} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.green, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>IN PROGRESS · {fmtTime(Date.now() - going.startedAt)}</Text>
            <Text style={ui.rowTitle}>{going.name}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={C.green} />
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Big icon="play" label="Start empty" sub="Add exercises as you go" onPress={() => router.push('/lift')} disabled={!!going} />
        <Big icon="plus" label="Build a workout" sub="Save it to reuse" onPress={() => router.push('/template')} />
      </View>
      {(list ?? []).map((t) => (
        <View key={t.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md }]}>
          <Pressable onPress={() => { tap(); router.push({ pathname: '/template', params: { id: t.id } }); }} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Edit ${t.name}`}>
            <Text style={ui.rowTitle}>{t.name}</Text>
            <Text style={ui.rowSub} numberOfLines={1}>{t.items.length} exercises · {t.items.slice(0, 3).map((i) => i.move_name).join(', ')}{t.items.length > 3 ? '…' : ''}</Text>
            {summary && t.user_id !== summary.me ? <Text style={{ color: C.faint, fontSize: 11 }}>Made by {name(t.user_id)}</Text> : null}
          </Pressable>
          <Pressable onPress={() => { tap(); if (going) router.push('/lift'); else router.push({ pathname: '/lift', params: { template: t.id } }); }}
            accessibilityRole="button" accessibilityLabel={`Start ${t.name}`}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <Icon name="play" size={24} color={C.onAccent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Big({ icon, label, sub, onPress, disabled }: { icon: 'play' | 'plus'; label: string; sub: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [ui.card, { flex: 1, gap: 6, paddingVertical: S.md, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={C.accent} />
      </View>
      <Text style={ui.rowTitle}>{label}</Text>
      <Text style={ui.rowSub}>{sub}</Text>
    </Pressable>
  );
}
