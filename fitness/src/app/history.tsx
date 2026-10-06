import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, changes, type Workout } from '../lib/api';
import { useStore } from '../lib/store';
import { C, S } from '../lib/theme';
import { friendly } from '../lib/dates';
import { animateList } from '../lib/motion';
import { Empty, Icon, IconBadge, Loading, styles as ui } from '../components/ui';
import { kindIcon } from '../components/fit';

/** Every session either of you logged, newest first. Long press to remove one. */
export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { name, color, refresh } = useStore();
  const [rows, setRows] = useState<Workout[] | null>(null);
  const [more, setMore] = useState(true);

  const load = useCallback(async () => {
    const r = await api<Workout[]>('/api/fit/workouts').catch(() => []);
    setRows(r); setMore(r.length === 60);
  }, []);
  useEffect(() => { load(); return changes.on(load); }, [load]);

  const loadMore = async () => {
    if (!rows?.length || !more) return;
    const r = await api<Workout[]>(`/api/fit/workouts?before=${rows[rows.length - 1].date}`).catch(() => []);
    const seen = new Set(rows.map((x) => x.id));
    setRows([...rows, ...r.filter((x) => !seen.has(x.id))]);
    setMore(r.length === 60);
  };

  const remove = (w: Workout) => Alert.alert('Remove this session?', w.together ? 'It was logged for both of you, so both entries go.' : `${w.title}, ${w.minutes} min`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      await api(`/api/fit/workouts/${w.id}`, { method: 'DELETE' }).catch(() => undefined);
      animateList();
      setRows((x) => x?.filter((r) => r.id !== w.id && (!w.group_id || r.group_id !== w.group_id)) ?? x);
      refresh();
    } },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, paddingBottom: S.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="arrow-left" color={C.sub} />
        </Pressable>
        <Text style={ui.h1}>Activity log</Text>
      </View>
      {!rows ? <Loading /> : (
        <FlatList
          data={rows}
          keyExtractor={(w) => w.id}
          onEndReached={loadMore}
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: insets.bottom + 40 }}
          ListHeaderComponent={<Text style={{ color: C.faint, fontSize: 12, marginBottom: S.md }}>Tap a session to delete it.</Text>}
          ListEmptyComponent={<Empty icon="run" title="Nothing logged yet" text="Finish a session or tap the plus on Today to log a walk." />}
          renderItem={({ item: w, index }) => {
            const newDay = index === 0 || rows[index - 1].date !== w.date;
            return (
              <View>
                {newDay ? <Text style={[ui.label, { marginTop: index ? S.lg : 0, marginBottom: S.sm }]}>{friendly(w.date)}</Text> : null}
                <Pressable onPress={() => remove(w)} onLongPress={() => remove(w)} accessibilityHint="Opens delete" style={({ pressed }) => [ui.card, pressed && { opacity: 0.75 }, { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.sm, paddingVertical: S.md }]}>
                  <IconBadge name={kindIcon(w.kind)} color={color(w.user_id)} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle} numberOfLines={1}>{w.title}</Text>
                    <Text style={ui.rowSub}>{name(w.user_id)}{w.together ? ' · together' : ''} · {['', 'Easy', 'Solid', 'Tough'][w.effort]}</Text>
                  </View>
                  <Text style={[{ color: C.ink, fontWeight: '700' }, ui.num]}>{w.minutes} min</Text>
                  <Icon name="trash-can-outline" size={20} color={C.faint} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
