import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { type Suggestion } from '../lib/api';
import { useObject } from '../lib/useList';
import { BackHeader } from '../components/BackHeader';
import { Appear } from '../components/Appear';
import { Button, Card, Empty, ErrorBar, Icon, Loading, SectionTitle, styles as ui } from '../components/ui';
import { C, S } from '../lib/theme';

type Ideas = { saved: Suggestion[]; online: Suggestion[]; pantry_count: number };

function Row({ s, onPress, first }: { s: Suggestion; onPress: () => void; first: boolean }) {
  const ready = s.need === 0;
  const pct = s.total ? Math.round((s.have / s.total) * 100) : 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${s.title}, ${s.have} of ${s.total} at home${s.need ? `, ${s.need} to buy` : ''}`}
      style={({ pressed }) => [ui.row, { opacity: pressed ? 0.8 : 1 }, !first && { borderTopWidth: 1, borderTopColor: C.line }]}>
      <View style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}>
        {s.image_url ? <Image source={{ uri: s.image_url }} style={{ width: 60, height: 60 }} accessible={false} /> : <Icon name="silverware-fork-knife" color={C.faint} />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={ui.rowTitle} numberOfLines={1}>{s.title}</Text>
        <Text style={[ui.rowSub, { marginTop: 0, color: ready ? C.accent : C.sub, fontWeight: '700' }]}>
          {ready ? (s.listed ? `Ready once the list is bought` : 'Everything at home') : [`${s.have} of ${s.total} at home`, s.listed ? `${s.listed} on the list` : null, `${s.need} to buy`].filter(Boolean).join(', ')}
        </Text>
        {!ready ? <Text style={[ui.rowSub, { marginTop: 0 }]} numberOfLines={1}>Need {s.missing.join(', ')}</Text> : null}
        {s.uses?.length ? <Text style={[ui.rowSub, { marginTop: 0 }]} numberOfLines={1}>Uses your {s.uses.join(', ').toLowerCase()}</Text> : null}
      </View>
      <View style={{ width: 40, alignItems: 'flex-end' }}>
        <Text style={[ui.num, { color: ready ? C.accent : C.ink, fontWeight: '800', fontSize: 15 }]}>{pct}%</Text>
      </View>
    </Pressable>
  );
}

export default function IdeasScreen() {
  const router = useRouter();
  const { data, error, reload } = useObject<Ideas>('/api/suggest', ['pantry_items', 'shopping_items', 'recipes']);
  const [refreshing, setRefreshing] = useState(false);
  const open = (id: string) => router.push({ pathname: '/recipe', params: { id } });

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Cook with what we have" subtitle="Ranked by how little you need to buy" />
      <ErrorBar error={error} />
      {!data && !error ? <Loading rows={6} /> : null}
      {data ? (
        <ScrollView contentContainerStyle={ui.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
          {data.pantry_count === 0 ? (
            <Card style={{ gap: S.md, marginTop: S.sm }}>
              <Text style={ui.rowTitle}>Tell the app what you have</Text>
              <Text style={ui.rowSub}>Ideas come from your At home list. Add what's in the fridge, freezer and pantry, or tap Done shopping after a shop.</Text>
              <Button kind="soft" icon="fridge-outline" title="Open At home" onPress={() => router.push('/shopping?view=home')} />
            </Card>
          ) : null}

          <SectionTitle>From our recipes</SectionTitle>
          {data.saved.length ? (
            <Card style={{ paddingVertical: S.xs }}>
              {data.saved.map((s, i) => <Appear key={s.id} index={i}><Row s={s} first={i === 0} onPress={() => open(s.id)} /></Appear>)}
            </Card>
          ) : <Text style={[ui.rowSub, { paddingHorizontal: S.xs }]}>Save a few recipes and they show up here, ranked by what you have.</Text>}

          <SectionTitle>New ideas</SectionTitle>
          {data.online.length ? (
            <Card style={{ paddingVertical: S.xs }}>
              {data.online.map((s, i) => <Appear key={s.id} index={i + data.saved.length}><Row s={s} first={i === 0} onPress={() => open(s.id)} /></Appear>)}
            </Card>
          ) : data.pantry_count ? (
            <Empty icon="magnify" title="No matches online" text="The recipe library searches by main ingredients like chicken, beef, rice or eggs. Add a few of those to At home." />
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
