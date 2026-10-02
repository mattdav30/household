import { useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, changes, type Bill, type CalEvent, type Chore, type Meal } from '../../lib/api';
import { useObject } from '../../lib/useList';
import { useSession } from '../../lib/session';
import { Card, Check, ErrorBar, Header, Icon, IconBadge, Pill, SectionTitle, styles as ui, type IconName } from '../../components/ui';
import { daysUntil, friendly, friendlyInline, money, time12 } from '../../lib/dates';
import { C, S } from '../../lib/theme';

type Today = { today: string; events: CalEvent[]; meals: Meal[]; chores: Chore[]; bills: Bill[]; shopping_open: number; pantry_count: number };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

function Tile({ icon, color, label, value, onPress }: { icon: IconName; color: string; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`} style={({ pressed }) => [ui.card, { flex: 1, gap: 10, padding: 14, opacity: pressed ? 0.85 : 1 }]}>
      <IconBadge name={icon} color={color} size={36} />
      <View>
        <Text style={[ui.num, { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.5 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { profile, memberName, memberColor } = useSession();
  const { data, error, reload } = useObject<Today>('/api/today', ['events', 'meals', 'chores', 'bills', 'shopping_items', 'pantry_items']);
  const [refreshing, setRefreshing] = useState(false);

  const complete = async (c: Chore) => {
    await api(`/api/chores/${c.id}/complete`, { method: 'POST' }).catch(() => undefined);
    changes.emit('chores');
  };

  const dinner = data?.meals.find((m) => m.slot === 'dinner') ?? data?.meals[0];
  const billsTotal = data?.bills.reduce((s, b) => s + (b.amount_cents ?? 0), 0) ?? 0;
  const evColor = (e: CalEvent) => e.color ?? (e.who === 'both' ? C.accent : memberColor(e.who));

  return (
    <View style={{ flex: 1 }}>
      <Header
        eyebrow={new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}${profile ? `, ${profile.user.name}` : ''}`}
      />
      <ErrorBar error={error} />
      <ScrollView contentContainerStyle={ui.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>

        <View style={{ flexDirection: 'row', gap: S.sm + 2, marginTop: S.sm }}>
          <Tile icon="cart-outline" color="#34C08A" label="to buy" value={String(data?.shopping_open ?? '·')} onPress={() => router.push('/shopping')} />
          <Tile icon="broom" color="#5B8DEF" label="chores due" value={String(data?.chores.length ?? '·')} onPress={() => router.push('/chores')} />
          <Tile icon="receipt-text-outline" color="#F2875E" label="bills this week" value={data ? (billsTotal ? money(billsTotal) : String(data.bills.length)) : '·'} onPress={() => router.push('/bills')} />
        </View>

        <SectionTitle>Dinner tonight</SectionTitle>
        <Pressable onPress={() => router.push(dinner ? '/meals' : '/ideas')} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
          {dinner?.image_url ? (
            <View style={{ borderRadius: 18, overflow: 'hidden', height: 170, backgroundColor: C.card }}>
              <Image source={{ uri: dinner.image_url }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" accessible={false} />
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.55)' }} />
              <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1, opacity: 0.8 }}>TONIGHT</Text>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }} numberOfLines={1}>{dinner.title}</Text>
              </View>
            </View>
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <IconBadge name="silverware-fork-knife" color={dinner ? C.accent : C.faint} />
              <View style={{ flex: 1 }}>
                <Text style={[ui.rowTitle, !dinner && { color: C.sub }]}>{dinner ? dinner.title : 'Nothing planned yet'}</Text>
                {!dinner ? <Text style={ui.rowSub}>See ideas from what we have</Text> : null}
              </View>
              <Icon name="chevron-right" color={C.faint} />
            </Card>
          )}
        </Pressable>

        <SectionTitle right={<Pressable onPress={() => router.push('/calendar')}><Text style={{ color: C.accent, fontWeight: '700' }}>Calendar</Text></Pressable>}>Coming up</SectionTitle>
        <Card style={{ paddingVertical: S.xs }}>
          {data && !data.events.length ? <Text style={[ui.rowSub, { paddingVertical: S.md }]}>A clear few days on the calendar.</Text> : null}
          {data?.events.map((e, i) => (
            <View key={e.id + e.date}>
              {i ? <View style={ui.sep} /> : null}
              <Pressable onPress={() => router.push('/calendar')} style={ui.row}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: evColor(e) }} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{e.title}</Text>
                  <Text style={ui.rowSub}>{friendly(e.date)}{e.start_time ? ` · ${time12(e.start_time)}` : ''}{e.who !== 'both' ? ` · ${memberName(e.who)}` : ''}</Text>
                </View>
                {e.repeat && e.repeat !== 'none' ? <Icon name="repeat" size={16} color={C.faint} /> : null}
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
                    <Check on={false} onPress={() => complete(c)} label={`Done: ${c.title}`} color={c.assignee_id ? memberColor(c.assignee_id) : C.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={ui.rowTitle}>{c.title}</Text>
                      <Text style={[ui.rowSub, c.due_date && daysUntil(c.due_date) < 0 && { color: C.warm }]}>
                        {c.due_date && daysUntil(c.due_date) < 0 ? `Overdue since ${friendlyInline(c.due_date)}` : 'Due today'}
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
                      <Text style={[ui.rowTitle, { fontWeight: '800' }]}>{money(b.amount_cents)}</Text>
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
