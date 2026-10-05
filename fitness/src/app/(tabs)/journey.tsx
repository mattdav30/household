import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useStore } from '../../lib/store';
import { api, type Stop, type Summary } from '../../lib/api';
import { C, S, tint } from '../../lib/theme';
import { friendly, money, toCents } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Button, Card, Field, Header, Icon, IconBadge, Loading, SectionTitle, Sheet, styles as ui, tap } from '../../components/ui';
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
  const next = j.next != null ? j.stops[j.next] : null;
  const pace = j.fraction - j.expected_fraction;
  const ch = summary.challenge;
  const last = ch.last;
  const jar = summary.jar;
  const toMove = Math.max(0, jar.earned_cents - jar.banked_cents);

  const openStop = (s: Stop) => { if (s.index === 0) return; tap(); setStop(s); setReward(s.reward ?? ''); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={`${j.km.toLocaleString()} of ${j.total_km.toLocaleString()} km`} title="The road to Tokyo"
          subtitle="Every minute either of you moves carries you both further." />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <RouteMap summary={summary} onStop={(i) => openStop(j.stops[i])} />
          </Appear>
          <Appear index={1}>
            <Card style={{ flexDirection: 'row', gap: S.md }}>
              <Stat value={`${Math.round(j.fraction * 100)}%`} label="of the way" color={C.accent} />
              <Stat value={next ? `${(next.km - j.km).toLocaleString()}` : '0'} label={next ? `km to ${next.name}` : 'km left'} />
              <Stat value={pace >= 0 ? 'On pace' : `${Math.ceil(-pace * j.goal_minutes)}m`} label={pace >= 0 ? `${Math.round(pace * j.total_km)} km ahead` : 'to catch up'} color={pace >= 0 ? C.green : C.gold} />
            </Card>
          </Appear>

          <SectionTitle>Stops and rewards</SectionTitle>
          <Text style={{ color: C.sub, fontSize: 13, marginTop: -S.xs, paddingHorizontal: S.xs }}>Set a reward for each stop together. Claim it when you arrive.</Text>
          <Card style={{ paddingVertical: S.xs }}>
            {j.stops.map((s, i) => {
              const isNext = s.index === j.next;
              const claimable = s.reached && s.reward && !s.claimed_at;
              return (
                <Pressable key={s.name} onPress={() => openStop(s)} disabled={i === 0} accessibilityRole="button"
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

          <SectionTitle>Gym fund</SectionTitle>
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
              {money(jar.banked_cents) || '$0'} saved of {money(jar.goal_cents)} for a gym membership.{toMove ? ` ${money(toMove)} ready to move.` : ''}
            </Text>
            {toMove ? <Button title={`I moved ${money(toMove)} to savings`} kind="soft" onPress={() => { setJarAmount((toMove / 100).toFixed(2)); setJarOpen(true); }} /> : null}
          </Card>
        </View>
      </ScrollView>

      <Sheet visible={!!stop} title={stop ? `Reward at ${stop.name}` : ''} onClose={() => setStop(null)} saving={busy}
        onSave={() => run(() => api<Summary>(`/api/fit/rewards/${stop!.index}`, { method: 'PUT', body: { title: reward } }), () => setStop(null))}>
        {stop ? <Text style={{ color: C.sub }}>{stop.note} {stop.reached ? 'You are already here.' : `${(stop.km - j.km).toLocaleString()} km to go.`}</Text> : null}
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
    </View>
  );
}
