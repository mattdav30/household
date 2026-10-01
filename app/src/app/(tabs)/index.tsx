import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, changes, type Bill, type CalEvent, type Chore, type Meal } from '../../lib/api';
import { useObject } from '../../lib/useList';
import { useSession } from '../../lib/session';
import { Card, Check, ErrorBar, Header, Icon, Pill, SectionTitle, styles as ui, type IconName } from '../../components/ui';
import { daysUntil, friendly, money, time12 } from '../../lib/dates';
import { C, S } from '../../lib/theme';

type Today = { today: string; events: CalEvent[]; meals: Meal[]; chores: Chore[]; bills: Bill[]; shopping_open: number };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

function Tile({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ui.card, { flex: 1, gap: 6, opacity: pressed ? 0.8 : 1 }]}>
      <Icon name={icon} color={C.accent} />
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.ink }}>{value}</Text>
      <Text style={{ fontSize: 13, color: C.sub }}>{label}</Text>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { profile, memberName, memberColor } = useSession();
  const { data, error, reload } = useObject<Today>('/api/today', ['events', 'meals', 'chores', 'bills', 'shopping_items']);
  const [refreshing, setRefreshing] = useState(false);

  const complete = async (c: Chore) => {
    await api(`/api/chores/${c.id}/complete`, { method: 'POST' }).catch(() => undefined);
    changes.emit('chores');
  };

  const dinner = data?.meals.find((m) => m.slot === 'dinner') ?? data?.meals[0];
  const billsTotal = data?.bills.reduce((s, b) => s + (b.amount_cents ?? 0), 0) ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <Header title={`${greeting()}${profile ? `, ${profile.user.name}` : ''}`} subtitle={new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} />
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={ui.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} />}>

        <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.sm }}>
          <Tile icon="cart-outline" label="to buy" value={String(data?.shopping_open ?? '·')} onPress={() => router.push('/shopping')} />
          <Tile icon="broom" label="chores due" value={String(data?.chores.length ?? '·')} onPress={() => router.push('/chores')} />
          <Tile icon="receipt-text-outline" label="bills this week" value={data ? (billsTotal ? money(billsTotal) : String(data.bills.length)) : '·'} onPress={() => router.push('/bills')} />
        </View>

        <SectionTitle>Dinner tonight</SectionTitle>
        <Pressable onPress={() => router.push('/meals')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <Icon name="silverware-fork-knife" color={dinner ? C.accent : C.faint} />
            <Text style={[ui.rowTitle, !dinner && { color: C.sub }]}>{dinner ? dinner.title : 'Nothing planned yet. Tap to plan.'}</Text>
          </Card>
        </Pressable>

        <SectionTitle>Coming up</SectionTitle>
        <Card style={{ paddingVertical: S.xs }}>
          {data && !data.events.length ? <Text style={[ui.rowSub, { paddingVertical: S.md }]}>A clear few days on the calendar.</Text> : null}
          {data?.events.map((e, i) => (
            <View key={e.id}>
              {i ? <View style={ui.sep} /> : null}
              <Pressable onPress={() => router.push('/calendar')} style={ui.row}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: e.who === 'both' ? C.accent : memberColor(e.who) }} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{e.title}</Text>
                  <Text style={ui.rowSub}>{friendly(e.date)}{e.start_time ? ` · ${time12(e.start_time)}` : ''}{e.who !== 'both' ? ` · ${memberName(e.who)}` : ''}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>

        {data?.chores.length ? (
          <>
            <SectionTitle>Chores due</SectionTitle>
            <Card style={{ paddingVertical: S.xs }}>
              {data.chores.map((c, i) => (
                <View key={c.id}>
                  {i ? <View style={ui.sep} /> : null}
                  <View style={ui.row}>
                    <Check on={false} onPress={() => complete(c)} />
                    <View style={{ flex: 1 }}>
                      <Text style={ui.rowTitle}>{c.title}</Text>
                      <Text style={[ui.rowSub, c.due_date && daysUntil(c.due_date) < 0 && { color: C.warm }]}>
                        {c.due_date && daysUntil(c.due_date) < 0 ? `Overdue since ${friendly(c.due_date).replace(/^(Yesterday)$/, 'yesterday')}` : 'Due today'}
                        {c.assignee_id ? ` · ${memberName(c.assignee_id)}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {data?.bills.length ? (
          <>
            <SectionTitle>Bills due soon</SectionTitle>
            <Card style={{ paddingVertical: S.xs }}>
              {data.bills.map((b, i) => {
                const d = daysUntil(b.due_date);
                return (
                  <View key={b.id}>
                    {i ? <View style={ui.sep} /> : null}
                    <Pressable onPress={() => router.push('/bills')} style={ui.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={ui.rowTitle}>{b.name}</Text>
                        <Text style={ui.rowSub}>{friendly(b.due_date)}</Text>
                      </View>
                      {d < 0 ? <Pill label="Overdue" color={C.warm} bg={C.warmSoft} /> : null}
                      <Text style={[ui.rowTitle, { fontWeight: '700' }]}>{money(b.amount_cents)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
