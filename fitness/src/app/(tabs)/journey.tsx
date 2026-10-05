import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useStore } from '../../lib/store';
import { api, type PastJourney, type Stop, type Summary } from '../../lib/api';
import { C, S, tint } from '../../lib/theme';
import { friendly, money, monthLabel, toCents } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, Field, Header, Icon, IconBadge, Loading, SectionTitle, Sheet, styles as ui, tap } from '../../components/ui';
import { Legend, RouteMap, Stat } from '../../components/fit';

const REWARD_IDEAS = ['Dinner out', 'Massage', 'New gym gear', 'Movie night, your pick', 'Day trip', 'New runners', 'Sleep in, breakfast in bed'];

export default function Journey() {
  const { summary, apply, refresh, name, color } = useStore();
  const [stop, setStop] = useState<Stop | null>(null);
  const [reward, setReward] = useState('');
  const [stakeOpen, setStakeOpen] = useState(false);
  const [stake, setStake] = useState('');
  const [jarOpen, setJarOpen] = useState(false);
  const [jarAmount, setJarAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [route, setRoute] = useState('seoul');
  const [weeks, setWeeks] = useState('12');
  const [title, setTitle] = useState('');
  const [past, setPast] = useState<PastJourney[]>([]);
  const finishedCount = summary?.journeys_finished ?? 0;
  useEffect(() => {
    if (finishedCount) api<PastJourney[]>('/api/fit/journeys').then(setPast).catch(() => undefined);
  }, [finishedCount]);

  const run = async (fn: () => Promise<Summary | { summary: Summary }>, after?: () => void) => {
    setBusy(true);
    try {
      const r = await fn();
      apply('summary' in r ? r.summary : r);
      after?.();
    } catch (e) { Alert.alert('That did not save', (e as Error).message); } finally { setBusy(false); }
  };
  const onRefresh = useCallback(async () => { setRefreshing(true); await refresh(); setRefreshing(false); }, [refresh]);

  if (!summary) return <View style={{ flex: 1 }}><Header title="Journey" /><Loading rows={5} /></View>;
  const j = summary.journey;
  const next = j && j.next != null ? j.stops[j.next] : null;
  const pace = j ? j.fraction - j.expected_fraction : 0;
  const openPicker = () => {
    tap();
    const suggestion = summary.routes.find((r) => r.id !== j?.route) ?? summary.routes[0];
    setRoute(suggestion.id); setTitle(''); setWeeks('12'); setPickOpen(true);
  };
  const startJourney = () => {
    const r = summary.routes.find((x) => x.id === route);
    run(() => api<Summary>('/api/fit/journeys', { method: 'POST', body: { route, weeks: Number(weeks), title: title.trim() || r?.title } }), () => {
      setPickOpen(false);
      api<PastJourney[]>('/api/fit/journeys').then(setPast).catch(() => undefined);
    });
  };
  const ch = summary.challenge;
  const last = ch.last;
  const jar = summary.jar;
  const toMove = Math.max(0, jar.earned_cents - jar.banked_cents);

  const openStop = (s: Stop) => { if (s.index === 0) return; tap(); setStop(s); setReward(s.reward ?? ''); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={j ? `${j.km.toLocaleString()} of ${j.total_km.toLocaleString()} km` : 'Journeys'} title={j ? j.title : 'Pick a journey'}
          subtitle={j ? `${friendly(j.start_date)} to ${friendly(j.end_date)}. Every minute either of you moves carries you both further.` : 'Pick a route and a length. Your minutes move you both along.'} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          {j ? (
            <Appear index={0}>
              <RouteMap journey={j} onStop={(i) => openStop(j.stops[i])} />
            </Appear>
          ) : null}

          {j && j.complete ? (
            <Appear index={1}>
              <View style={[ui.card, { gap: S.md, borderColor: C.gold, backgroundColor: C.goldSoft }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <IconBadge name="flag-checkered" color={C.gold} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.h2}>{j.arrived ? 'Journey complete' : 'Journey ended'}</Text>
                    <Text style={ui.rowSub}>{j.arrived ? `You made it all the way to ${j.stops[j.stops.length - 1].name}.` : `You reached ${[...j.stops].reverse().find((x) => x.reached)?.name ?? j.stops[0].name}.`}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  <Stat value={`${j.minutes.toLocaleString()}`} label="minutes together" />
                  <Stat value={`${j.km.toLocaleString()}`} label="km travelled" />
                  <Stat value={`${j.stops_reached}/${j.stops.length}`} label="stops" />
                </View>
                <Button title="Start the next journey" icon="map-marker-path" onPress={openPicker} />
              </View>
            </Appear>
          ) : j ? (
            <Appear index={1}>
              <Card style={{ flexDirection: 'row', gap: S.md }}>
                <Stat value={`${Math.round(j.fraction * 100)}%`} label="of the way" color={C.accent} />
                <Stat value={next ? `${(next.km - j.km).toLocaleString()}` : '0'} label={next ? `km to ${next.name}` : 'km left'} />
                <Stat value={pace >= 0 ? 'On pace' : `${Math.ceil(-pace * j.goal_minutes)}m`} label={pace >= 0 ? `${Math.round(pace * j.total_km)} km ahead` : 'to catch up'} color={pace >= 0 ? C.green : C.gold} />
              </Card>
            </Appear>
          ) : (
            <Button title="Pick a journey" icon="map-marker-path" onPress={openPicker} />
          )}

          {j ? (
            <>
              <SectionTitle>Stops and rewards</SectionTitle>
              <Text style={{ color: C.sub, fontSize: 13, marginTop: -S.xs, paddingHorizontal: S.xs }}>Set a reward for each stop together. Claim it when you arrive.</Text>
              <Card style={{ paddingVertical: S.xs }}>
                {j.stops.map((s, i) => {
                  const isNext = s.index === j.next && !j.complete;
                  const claimable = s.reached && s.reward && !s.claimed_at;
                  return (
                    <Pressable key={`${s.name}${i}`} onPress={() => openStop(s)} disabled={i === 0} accessibilityRole="button"
                      style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null, isNext && { backgroundColor: tint(C.accent, 0.06) }]}>
                      <View style={{ width: 26, alignItems: 'center' }}>
                        <Icon name={s.reached ? 'map-marker-check' : isNext ? 'map-marker-right' : 'map-marker-outline'} size={22}
                          color={s.reached ? C.accent : isNext ? C.warm : C.faint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[ui.rowTitle, !s.reached && !isNext && { color: C.sub }]}>{s.name}</Text>
                        <Text style={ui.rowSub} numberOfLines={2}>
                          {i === 0 ? s.note : s.reward ? `${s.claimed_at ? 'Claimed' : 'Reward'}: ${s.reward}` : s.reached ? s.note : 'Tap to set a reward'}
                        </Text>
                      </View>
                      {claimable ? (
                        <Pressable onPress={() => run(() => api<Summary>(`/api/fit/rewards/${s.index}/claim`, { method: 'POST' }))} style={[ui.headerBtn, { backgroundColor: C.goldSoft }]}>
                          <Icon name="gift" size={17} color={C.gold} />
                          <Text style={{ color: C.gold, fontWeight: '700' }}>Claim</Text>
                        </Pressable>
                      ) : (
                        <Text style={[{ color: s.reached ? C.accent : C.faint, fontSize: 13, fontWeight: '700' }, ui.num]}>
                          {s.reached ? (s.claimed_at ? 'Enjoyed' : 'Reached') : `${(s.km - j.km).toLocaleString()} km`}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            </>
          ) : null}

          <SectionTitle right={<Pressable onPress={() => { setStake(ch.stake); setStakeOpen(true); }} hitSlop={8}><Text style={{ color: C.accent, fontWeight: '700' }}>Change stake</Text></Pressable>}>Weekly challenge</SectionTitle>
          <Card style={{ gap: S.md }}>
            <Text style={{ color: C.sub }}>Most minutes from Monday to Sunday wins.</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Icon name="trophy" color={C.gold} />
              <Text style={[ui.rowTitle, { flex: 1 }]}>{ch.stake}</Text>
            </View>
            <Legend summary={summary} values={ch.by_user} />
            {(() => {
              const vals = summary.members.map((m) => ch.by_user[m.id] ?? 0);
              const max = Math.max(1, ...vals);
              return summary.members.map((m) => (
                <View key={m.id} style={{ gap: 4 }}>
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: C.raised, overflow: 'hidden' }}>
                    <View style={{ height: 10, width: `${((ch.by_user[m.id] ?? 0) / max) * 100}%`, backgroundColor: color(m.id) }} />
                  </View>
                </View>
              ));
            })()}
            {last ? (
              <View style={[ui.card, { backgroundColor: C.raised, gap: S.sm }]}>
                <Text style={{ color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>LAST WEEK</Text>
                {last.winner ? (
                  <>
                    <Text style={ui.rowTitle}>{name(last.winner)} won, {last.by_user[last.winner]} to {last.by_user[last.loser!]} minutes.</Text>
                    <Text style={ui.rowSub}>{name(last.loser)} owes: {last.stake}</Text>
                    {last.meal_id ? (
                      <Text style={{ color: C.green, fontSize: 13 }}>On the Household meal plan.</Text>
                    ) : (
                      <Button title="Add to Household meals" kind="soft" icon="chef-hat" busy={busy}
                        onPress={() => run(() => api<{ summary: Summary }>('/api/fit/challenge/cook', { method: 'POST', body: {} }), () => Alert.alert('Added', `${name(last.loser)} cooks Saturday. It is on the Household meal plan.`))} />
                    )}
                  </>
                ) : <Text style={ui.rowTitle}>A tie. Nobody pays up.</Text>}
              </View>
            ) : null}
          </Card>

          <SectionTitle>The fund</SectionTitle>
          <Card style={{ gap: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
              <IconBadge name="piggy-bank" color={C.green} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={ui.h2}>{money(jar.earned_cents) || '$0'}</Text>
                <Text style={ui.rowSub}>{money(jar.rate_cents)} for each day each of you moves 10+ minutes</Text>
              </View>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: C.raised, overflow: 'hidden', flexDirection: 'row' }}>
              <View style={{ width: `${Math.min(100, (jar.banked_cents / Math.max(1, jar.goal_cents)) * 100)}%`, backgroundColor: C.green }} />
              <View style={{ width: `${Math.min(100, (toMove / Math.max(1, jar.goal_cents)) * 100)}%`, backgroundColor: tint(C.green, 0.4) }} />
            </View>
            <Text style={{ color: C.sub, fontSize: 13 }}>
              {money(jar.banked_cents) || '$0'} saved of {money(jar.goal_cents)} for {jar.label}.{toMove ? ` ${money(toMove)} ready to move.` : ''}
            </Text>
            {toMove ? <Button title={`I moved ${money(toMove)} to savings`} kind="soft" onPress={() => { setJarAmount((toMove / 100).toFixed(2)); setJarOpen(true); }} /> : null}
          </Card>

          {past.length ? (
            <>
              <SectionTitle>Finished journeys</SectionTitle>
              <Card style={{ paddingVertical: S.xs }}>
                {past.map((p, i) => (
                  <View key={p.id} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                    <IconBadge name={p.arrived ? 'trophy' : 'flag-outline'} color={p.arrived ? C.gold : C.sub} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={ui.rowTitle}>{p.title}</Text>
                      <Text style={ui.rowSub}>{p.arrived ? 'Completed' : `Reached ${p.furthest}`} · {p.minutes.toLocaleString()} min · {monthLabel(p.start_date)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {j && !j.complete ? (
            <Pressable onPress={() => Alert.alert('Switch journeys?', `${j.title} ends here and goes on the finished shelf. Your minutes, streaks and fund stay as they are.`, [
              { text: 'Cancel', style: 'cancel' }, { text: 'Pick a new route', onPress: openPicker },
            ])} style={{ alignSelf: 'center', paddingVertical: S.lg }}>
              <Text style={{ color: C.sub, fontWeight: '600' }}>Switch to a different journey</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Sheet visible={!!stop} title={stop ? `Reward at ${stop.name}` : ''} onClose={() => setStop(null)} saving={busy}
        onSave={() => run(() => api<Summary>(`/api/fit/rewards/${stop!.index}`, { method: 'PUT', body: { title: reward } }), () => setStop(null))}>
        {stop ? <Text style={{ color: C.sub }}>{stop.note} {stop.reached ? 'You are already here.' : `${(stop.km - (j?.km ?? 0)).toLocaleString()} km to go.`}</Text> : null}
        <Field label="Reward" value={reward} onChangeText={setReward} placeholder="Something you both look forward to" />
        <View style={ui.chips}>
          {REWARD_IDEAS.map((r) => (
            <Pressable key={r} onPress={() => { tap(); setReward(r); }} style={ui.chip}><Text style={ui.chipText}>{r}</Text></Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={stakeOpen} title="This week's stake" onClose={() => setStakeOpen(false)} saving={busy}
        onSave={() => run(() => api<Summary>('/api/fit/challenge', { method: 'PUT', body: { stake } }), () => setStakeOpen(false))}>
        <Field label="Loser has to" value={stake} onChangeText={setStake} placeholder="Cook dinner on Saturday" />
        <View style={ui.chips}>
          {['Loser cooks dinner on Saturday', 'Loser does the dishes all week', 'Loser plans date night', 'Loser gives a 20 minute massage', 'Loser makes coffee every morning'].map((r) => (
            <Pressable key={r} onPress={() => { tap(); setStake(r); }} style={ui.chip}><Text style={ui.chipText}>{r}</Text></Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={jarOpen} title="Move to savings" onClose={() => setJarOpen(false)} saving={busy} saveLabel="Mark as moved"
        onSave={() => run(() => api<Summary>('/api/fit/jar', { method: 'POST', body: { amount_cents: toCents(jarAmount), note: `Moved ${friendly(summary.today)}` } }), () => setJarOpen(false))}>
        <Text style={{ color: C.sub }}>Transfer the money to your savings account in your banking app first, then record it here.</Text>
        <Field label="Amount moved" value={jarAmount} onChangeText={setJarAmount} keyboardType="decimal-pad" />
      </Sheet>

      <Sheet visible={pickOpen} title="Next journey" onClose={() => setPickOpen(false)} onSave={startJourney} saving={busy} saveLabel="Start journey">
        <Text style={{ color: C.sub }}>Pick a route and how long to give it. The map paces itself to your weekly goal of {summary.week.goal} minutes.</Text>
        {summary.routes.map((r) => {
          const on = r.id === route;
          return (
            <Pressable key={r.id} onPress={() => { tap(); setRoute(r.id); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={[ui.card, { gap: 4, backgroundColor: on ? C.accentSoft : C.raised, borderColor: on ? C.accent : C.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[ui.rowTitle, { flex: 1 }]}>{r.title}</Text>
                <Text style={[{ color: C.sub, fontSize: 13 }, ui.num]}>{r.total_km.toLocaleString()} km · {r.stops} stops</Text>
              </View>
              <Text style={ui.rowSub}>{r.blurb}</Text>
            </Pressable>
          );
        })}
        <Chips label="Length" value={weeks} onChange={setWeeks} options={[
          { value: '4', label: '4 weeks' }, { value: '8', label: '8 weeks' }, { value: '12', label: '12 weeks' }, { value: '26', label: '6 months' }, { value: '52', label: 'A year' },
        ]} />
        <Field label="Name (optional)" value={title} onChangeText={setTitle} placeholder={summary.routes.find((r) => r.id === route)?.title} />
      </Sheet>
    </View>
  );
}
