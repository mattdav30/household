import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { todaysSession, TYPE_INFO } from '../../lib/plan';
import { local } from '../../lib/local';
import { weatherIcon } from '../../lib/weather';
import { C, S, tint } from '../../lib/theme';
import { friendly } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Button, Card, ErrorBar, Fab, Header, HeaderButton, Icon, IconBadge, Loading, SectionTitle, styles as ui, tap } from '../../components/ui';
import { Legend, LogSheet, SplitBar, Stat, WeekBars, accentOf, kindIcon } from '../../components/fit';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};

export default function Today() {
  const router = useRouter();
  const { summary, error, weather, refresh, planInput, name, color } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [shuffle, setShuffle] = useState(() => (summary ? local.shuffle(summary.today) : 0));

  const plan = useMemo(() => {
    const p = planInput({ shuffle });
    return p ? todaysSession(p) : null;
  }, [planInput, shuffle]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await refresh(); setRefreshing(false); }, [refresh]);

  if (!summary || !plan) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Road to Tokyo" />
        <ErrorBar error={error} />
        {!error ? <Loading rows={4} /> : <View style={{ padding: S.lg }}><Button title="Try again" onPress={refresh} kind="soft" /></View>}
      </View>
    );
  }

  const me = summary.members.find((m) => m.id === summary.me)!;
  const { session, swapped } = plan;
  const info = TYPE_INFO[session.type];
  const col = accentOf(info.color);
  const myStreak = summary.streaks[summary.me];
  const minutesToday = summary.week.days.find((d) => d.date === summary.today)?.by_user ?? {};
  const next = summary.journey.next != null ? summary.journey.stops[summary.journey.next] : null;
  const kmLeft = next ? next.km - summary.journey.km : 0;
  const minLeft = Math.ceil(kmLeft / summary.journey.km_per_minute);
  const pace = summary.journey.fraction - summary.journey.expected_fraction;
  const paceText = pace >= 0
    ? `On pace, ${Math.round(pace * summary.journey.total_km)} km ahead`
    : `${Math.ceil((-pace * summary.journey.goal_minutes))} minutes to catch the schedule`;

  const start = (type = session.type, s = shuffle) => { tap(); router.push({ pathname: '/session', params: { type, shuffle: String(s) } }); };
  const reshuffle = () => { const n = shuffle + 1; setShuffle(n); local.setShuffle(summary.today, n); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={`${summary.days_to_wedding} days to the wedding`} title={`${greeting()}, ${me.name}`}
          subtitle={`Week ${summary.week_index + 1} of ${summary.total_weeks}`}
          right={<HeaderButton icon="cog-outline" a11y="Settings" onPress={() => router.push('/settings')} />} />
        <ErrorBar error={error} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {weather ? (
            <Appear index={0}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: S.xs }}>
                <Icon name={weatherIcon(weather) as never} size={18} color={C.sub} />
                <Text style={{ color: C.sub, fontSize: 14 }}>
                  Brisbane {weather.minTemp}° to {weather.maxTemp}°{weather.rainChance >= 30 ? `, ${weather.rainChance}% chance of rain` : ''}
                </Text>
              </View>
            </Appear>
          ) : null}

          <Appear index={1}>
            <View style={[ui.card, { borderColor: tint(col, 0.5), backgroundColor: tint(col, 0.08), gap: S.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <IconBadge name={info.icon as never} color={col} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: col, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>TODAY'S SESSION</Text>
                  <Text style={ui.h2}>{session.title}</Text>
                  <Text style={ui.rowSub}>{session.minutes} min{session.outdoor ? ' · outdoors' : ''}{session.partner ? ' · for two' : ''}</Text>
                </View>
              </View>
              <Text style={{ color: C.sub, fontSize: 14, lineHeight: 20 }}>{session.note ?? session.blurb}</Text>
              {swapped ? <Text style={{ color: C.gold, fontSize: 13 }}>{swapped}</Text> : null}
              {session.place ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="map-marker" size={16} color={C.warm} />
                  <Text style={{ color: C.sub, fontSize: 13, flex: 1 }}><Text style={{ color: C.ink, fontWeight: '700' }}>{session.place.name}. </Text>{session.place.tip}</Text>
                </View>
              ) : null}
              {myStreak?.done_today ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="check-circle" size={20} color={C.green} />
                  <Text style={{ color: C.green, fontWeight: '700' }}>Done today, {minutesToday[summary.me]} min. Extra still counts.</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}><Button title="Start" icon="play" onPress={() => start()} /></View>
                <Pressable onPress={() => { tap(); reshuffle(); }} accessibilityRole="button" accessibilityLabel="Shuffle the workout"
                  style={({ pressed }) => [ui.btn, { backgroundColor: C.raised, width: 56, paddingHorizontal: 0, opacity: pressed ? 0.7 : 1 }]}>
                  <Icon name="shuffle-variant" size={22} color={C.ink} />
                </Pressable>
              </View>
              {!myStreak?.done_today ? (
                <Pressable onPress={() => start('quick', shuffle)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 4 }}>
                  <Text style={{ color: C.accent, fontWeight: '700' }}>Low on drive? Do ten minutes</Text>
                </Pressable>
              ) : null}
            </View>
          </Appear>

          <Appear index={2}>
            <SectionTitle right={<Text style={[{ color: C.sub, fontWeight: '700' }, ui.num]}>{summary.week.total} / {summary.week.goal} min</Text>}>This week together</SectionTitle>
            <Card style={{ gap: S.md }}>
              <SplitBar summary={summary} values={summary.week.by_user} goal={summary.week.goal} />
              <Legend summary={summary} values={summary.week.by_user} />
              <WeekBars summary={summary} />
            </Card>
          </Appear>

          <Appear index={3}>
            <SectionTitle>Streaks</SectionTitle>
            <View style={{ flexDirection: 'row', gap: S.md }}>
              {summary.members.map((m) => {
                const st = summary.streaks[m.id];
                return (
                  <Card key={m.id} style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: color(m.id), fontWeight: '800' }}>{m.name}</Text>
                    <Stat value={`${st?.days ?? 0}`} label={st?.days === 1 ? 'day' : 'days'} icon="fire" color={st?.done_today ? C.gold : C.ink} />
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {Array.from({ length: 2 }, (_, i) => <Icon key={i} name={i < (st?.shields_left ?? 0) ? 'shield-check' : 'shield-outline'} size={16} color={i < (st?.shields_left ?? 0) ? C.accent : C.faint} />)}
                      <Text style={{ color: C.sub, fontSize: 12, marginLeft: 2 }}>shields left</Text>
                    </View>
                    {st?.last_shield && st.last_shield >= summary.week.start ? <Text style={{ color: C.sub, fontSize: 12 }}>Shield saved {friendly(st.last_shield)}</Text> : null}
                  </Card>
                );
              })}
            </View>
          </Appear>

          <Appear index={4}>
            <SectionTitle>The road</SectionTitle>
            <Pressable onPress={() => router.push('/journey')} accessibilityRole="button" style={({ pressed }) => [ui.card, { gap: S.sm, opacity: pressed ? 0.85 : 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <IconBadge name="airplane" color={C.warm} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{next ? `${kmLeft.toLocaleString()} km to ${next.name}` : 'You made it to the onsen'}</Text>
                  <Text style={ui.rowSub}>{next ? `About ${minLeft} more minutes between you${next.reward ? `. Reward: ${next.reward}` : ''}` : 'Every reward unlocked.'}</Text>
                </View>
                <Icon name="chevron-right" color={C.faint} />
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: C.raised, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${summary.journey.fraction * 100}%`, backgroundColor: C.accent }} />
              </View>
              <Text style={{ color: pace >= 0 ? C.green : C.sub, fontSize: 13 }}>{paceText}</Text>
            </Pressable>
          </Appear>

          <Appear index={5}>
            <SectionTitle>This week's challenge</SectionTitle>
            <Pressable onPress={() => router.push('/journey')} style={({ pressed }) => [ui.card, { gap: S.sm, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ color: C.sub, fontSize: 13 }}>Most minutes by Sunday night wins. Stake: <Text style={{ color: C.ink, fontWeight: '700' }}>{summary.challenge.stake}</Text></Text>
              <Legend summary={summary} values={summary.challenge.by_user} />
              {summary.challenge.last?.winner ? (
                <Text style={{ color: C.gold, fontSize: 13 }}>Last week: {name(summary.challenge.last.winner)} won. {name(summary.challenge.last.loser)} pays up.</Text>
              ) : null}
            </Pressable>
          </Appear>

          <Appear index={6}>
            <SectionTitle right={<Pressable onPress={() => router.push('/history')}><Text style={{ color: C.accent, fontWeight: '700' }}>All</Text></Pressable>}>Recent</SectionTitle>
            <Card style={{ paddingVertical: S.xs }}>
              {summary.recent.length ? summary.recent.slice(0, 5).map((w, i) => (
                <View key={w.id} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                  <IconBadge name={kindIcon(w.kind)} color={color(w.user_id)} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle} numberOfLines={1}>{w.title}</Text>
                    <Text style={ui.rowSub}>{name(w.user_id)} · {friendly(w.date)}{w.together ? ' · together' : ''}</Text>
                  </View>
                  <Text style={[{ color: C.ink, fontWeight: '700' }, ui.num]}>{w.minutes} min</Text>
                </View>
              )) : <Text style={{ color: C.sub, paddingVertical: S.md }}>Your first session lands here. Start with ten minutes.</Text>}
            </Card>
          </Appear>
        </View>
      </ScrollView>
      <Fab icon="plus" label="Log activity" onPress={() => setLogging(true)} />
      <LogSheet visible={logging} onClose={() => setLogging(false)} />
    </View>
  );
}
