// Pick exercises from the full list: search, filter by muscle group, tick several, or add your own.
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S, tint } from '../lib/theme';
import { customMove, GROUPS, searchMoves, type Group, type Move, type Track } from '../lib/lifts';
import { Button, Icon, styles as ui, tap } from './ui';

const TRACK_LABEL: Record<Track, string> = { weight: 'Weight and reps', reps: 'Reps', time: 'Time', cardio: 'Minutes and distance' };

export function MovePicker({ visible, onClose, onPick, recent = [] }: { visible: boolean; onClose: () => void; onPick: (moves: Move[]) => void; recent?: Move[] }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [picked, setPicked] = useState<Move[]>([]);
  const [ownTrack, setOwnTrack] = useState<Track>('weight');
  useEffect(() => { if (visible) { setQ(''); setGroup(null); setPicked([]); } }, [visible]);

  const list = useMemo(() => searchMoves(q, group, recent), [q, group, recent]);
  const exact = list.some((m) => m.name.toLowerCase() === q.trim().toLowerCase());
  const toggle = (m: Move) => { tap(); setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : [...p, m])); };
  const done = () => { if (picked.length) onPick(picked); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + S.md }}>
        <View style={{ paddingHorizontal: S.lg, gap: S.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <Text style={[ui.h2, { flex: 1 }]}>Add exercises</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
              <Icon name="close" color={C.sub} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: C.raised, borderRadius: 14, paddingHorizontal: S.md }}>
            <Icon name="magnify" size={20} color={C.faint} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search, like bench, curl or db row" placeholderTextColor={C.faint} autoCorrect={false}
              style={{ flex: 1, color: C.ink, fontSize: 16, paddingVertical: 12 }} returnKeyType="search" accessibilityLabel="Search exercises" />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search"><Icon name="close-circle" size={18} color={C.faint} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
            {[null, ...GROUPS].map((g) => {
              const on = group === g;
              return (
                <Pressable key={g ?? 'all'} onPress={() => { tap(); setGroup(g); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[ui.chip, { backgroundColor: on ? C.accentSoft : C.raised, borderColor: on ? C.accent : C.line }]}>
                  <Text style={[ui.chipText, on && { color: C.accent, fontWeight: '700' }]}>{g ?? 'All'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: 140, paddingTop: S.sm }}
          ListFooterComponent={q.trim().length > 1 && !exact ? (
            <View style={[ui.card, { gap: S.sm, marginTop: S.md, borderColor: tint(C.accent, 0.5) }]}>
              <Text style={ui.rowTitle}>Add "{q.trim()}" as your own exercise</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(TRACK_LABEL) as Track[]).map((t) => (
                  <Pressable key={t} onPress={() => setOwnTrack(t)} style={[ui.chip, { backgroundColor: ownTrack === t ? C.accentSoft : C.raised, borderColor: ownTrack === t ? C.accent : C.line }]}>
                    <Text style={[ui.chipText, ownTrack === t && { color: C.accent, fontWeight: '700' }]}>{TRACK_LABEL[t]}</Text>
                  </Pressable>
                ))}
              </View>
              <Button title="Add it" kind="soft" icon="plus" onPress={() => { const m = customMove(q, ownTrack); setPicked((p) => [...p.filter((x) => x.id !== m.id), m]); setQ(''); }} />
            </View>
          ) : null}
          renderItem={({ item: m }) => {
            const on = picked.some((x) => x.id === m.id);
            return (
              <Pressable onPress={() => toggle(m)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.7 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.rowTitle, on && { color: C.accent }]}>{m.name}</Text>
                  <Text style={ui.rowSub}>{m.group} · {m.equip}{m.track === 'time' ? ' · timed' : m.track === 'cardio' ? ' · cardio' : ''}</Text>
                </View>
                <Icon name={on ? 'check-circle' : 'plus-circle-outline'} size={26} color={on ? C.accent : C.faint} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: C.sub, textAlign: 'center', marginTop: S.xl }}>No match. Add it as your own below.</Text>}
        />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: S.lg, paddingBottom: insets.bottom + S.lg, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line }}>
          <Button title={picked.length ? `Add ${picked.length} ${picked.length === 1 ? 'exercise' : 'exercises'}` : 'Tick the exercises to add'} onPress={done} icon="check" />
        </View>
      </View>
    </Modal>
  );
}
