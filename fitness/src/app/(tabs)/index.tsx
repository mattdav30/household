import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { api, changes, type Summary } from '../../lib/api';
import { todaysSession, TYPE_INFO } from '../../lib/plan';
import { local } from '../../lib/local';
import { weatherIcon } from '../../lib/weather';
import { C, S, tint } from '../../lib/theme';
import { friendly } from '../../lib/dates';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, ErrorBar, Field, Header, HeaderButton, Icon, IconBadge, Loading, SectionTitle, Swatches, styles as ui, tap } from '../../components/ui';
import { Legend, LogSheet, WeekBars, kindIcon } from '../../components/fit';
import { PET_COLORS, petLine } from '../../components/Pet';
import { Pet3D } from '../../components/pet3d/Pet3D';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};

export default function Home() {
  const router = useRouter();
  const { summary, error, weather, refresh, apply, planInput, name, color, partner, steps, imported, clearImported } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [party, setParty] = useState(0);

  const plan = useMemo(() => {
    const p = planInput();
    return p ? todaysSession(p) : null;
  }, [planInput]);

  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 5000); return () => clearTimeout(t); }, [said]);
  // Celebrate sessions that arrive from Samsung Health.
  useEffect(() => {
    if (!imported) return;
    setSaid(`Samsung Health sent over ${imported} ${imported === 1 ? 'session' : 'sessions'}. Thank you!`);
    setParty((n) => n + 1);
    clearImported();
  }, [imported, clearImported]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await refresh(); setRefreshing(false); }, [refresh]);

  if (!summary || !plan) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Tandem" />
        <ErrorBar error={error} />
        {!error ? <Loading rows={4} /> : <View style={{ padding: S.lg }}><Button title="Try again" onPress={refresh} kind="soft" /></View>}
      </View>
    );
  }

  if (!summary.pet.name) return <Welcome />;

  const me = summary.members.find((m) => m.id === summary.me)!;
  const pet = summary.pet;
  const step = summary.steps.find((s) => s.step === me.step)!;
  const nextStep = summary.steps.find((s) => s.step === me.step + 1);
  const streak = summary.streaks[summary.me];
  const pct = Math.min(1, me.today_minutes / me.target);
  const { session, swapped } = plan;
  const info = TYPE_INFO[session.type];
  const showStepUp = me.can_step_up && nextStep && !local.stepUpSnoozed(summary.today);
  const toGrow = pet.next_stage_at != null ? pet.next_stage_at - pet.growth : null;
  const line = said ?? petLine({
    name: pet.name!, mood: pet.mood, meName: me.name, partnerName: partner?.name ?? null,
    meFed: !!pet.fed[me.id], partnerFed: partner ? !!pet.fed[partner.id] : false, hour: new Date().getHours(),
  });

  const quickLog = async (minutes: number) => {
    tap();
    setBusy(minutes);
    try {
      const r = await api<{ summary: Summary }>('/api/fit/workouts', { method: 'POST', body: { kind: 'walk', minutes, title: `${minutes} minute walk` } });
      apply(r.summary);
      changes.emit('workouts');
      const meAfter = r.summary.members.find((m) => m.id === r.summary.me)!;
      setParty((n) => n + 1);
      setSaid(meAfter.today_minutes >= meAfter.target ? `Yum! That's your step done for today, ${me.name}.` : `Thanks! ${meAfter.target - meAfter.today_minutes} more minutes for your step.`);
    } catch (e) { setSaid((e as Error).message); } finally { setBusy(null); }
  };
  const stepUp = async () => {
    tap();
    try { apply(await api<Summary>('/api/fit/profile', { method: 'PATCH', body: { step: me.step + 1 } })); setParty((n) => n + 1); setSaid(`Step ${me.step + 1}! I'm so proud of you.`); } catch { /* next refresh */ }
  };
  const start = (type = session.type) => { tap(); router.push({ pathname: '/session', params: { type } }); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={summary.countdown.days > 0 ? `${summary.countdown.days} days to ${summary.countdown.label}` : `${streak.days} day streak`}
          title={`${greeting()}, ${me.name}`}
          right={<HeaderButton icon="cog-outline" a11y="Settings" onPress={() => router.push('/settings')} />} />
        <ErrorBar error={error} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>
          <Appear index={0}>
            <View style={[ui.card, { alignItems: 'center', gap: S.sm, paddingTop: S.lg }]}>
              <View style={{ backgroundColor: C.raised, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '90%' }}>
                <Text style={{ color: C.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' }} accessibilityLiveRegion="polite">{line}</Text>
              </View>
              <Pet3D kind="dog" color={pet.color} mood={pet.mood} stage={pet.stage} size={230} celebrate={party}
                onTap={() => setSaid(pet.mood === 'sad' ? 'A walk would cheer me up.' : ['Hehe!', 'Again!', `I love you, ${me.name}.`, 'Walkies?'][Math.floor(Math.random() * 4)])} />
              <Text style={ui.h2}>{pet.name}</Text>
              <Text style={{ color: C.sub, fontSize: 13 }}>
                {toGrow != null ? `${toGrow} more ${toGrow === 1 ? 'day' : 'days'} of moving until ${pet.name} grows` : `${pet.name} is fully grown and wearing the crown`}
              </Text>
              {toGrow != null ? (
                <View style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: C.raised, overflow: 'hidden', marginHorizontal: S.lg }}>
                  <View style={{ height: 6, width: `${Math.min(100, (pet.growth / pet.next_stage_at!) * 100)}%`, backgroundColor: C.gold }} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: S.md, alignSelf: 'stretch', marginTop: S.sm }}>
                {summary.members.map((m) => {
                  const fed = !!pet.fed[m.id];
                  return (
                    <View key={m.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: S.md, borderRadius: 14, backgroundColor: fed ? tint(color(m.id), 0.14) : C.raised }}>
                      <Icon name={fed ? 'bowl' : 'bowl-outline'} size={26} color={fed ? color(m.id) : C.faint} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.ink, fontWeight: '700' }}>{m.name}</Text>
                        <Text style={{ color: C.sub, fontSize: 12 }}>{fed ? `Fed, ${m.today_minutes} min` : 'Not yet today'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Appear>

          {showStepUp ? (
            <Appear index={1}>
              <View style={[ui.card, { gap: S.md, borderColor: C.green }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <IconBadge name="stairs-up" color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle}>Ready for step {nextStep!.step}?</Text>
                    <Text style={ui.rowSub}>You hit your step on {me.hits_7} of the last 7 days. Next up: {nextStep!.title.toLowerCase()}, {nextStep!.target} minutes.</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  <View style={{ flex: 1 }}><Button title="Step up" onPress={stepUp} /></View>
                  <View style={{ flex: 1 }}><Button title="Stay here" kind="ghost" onPress={() => { local.snoozeStepUp(summary.today); refresh(); }} /></View>
                </View>
              </View>
            </Appear>
          ) : null}

          <Appear index={2}>
            <SectionTitle right={<Text style={{ color: C.sub, fontWeight: '700' }}>Step {me.step} of {summary.steps.length}</Text>}>Your step today</SectionTitle>
            <Card style={{ gap: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 5, borderColor: pct >= 1 ? C.green : C.raised, alignItems: 'center', justifyContent: 'center' }}>
                  {pct >= 1 ? <Icon name="check" size={26} color={C.green} /> : <Text style={[{ color: C.ink, fontWeight: '800' }, ui.num]}>{Math.round(pct * 100)}%</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{step.title}</Text>
                  <Text style={ui.rowSub}>{pct >= 1 ? `Done. ${me.today_minutes} minutes today.` : `${me.today_minutes} of ${me.target} minutes. ${step.tip}`}</Text>
                </View>
              </View>
              <Text style={ui.label}>Log a walk</Text>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {[10, 15, 20, 30].map((m) => (
                  <Pressable key={m} onPress={() => quickLog(m)} disabled={busy != null} accessibilityRole="button" accessibilityLabel={`Log a ${m} minute walk`}
                    style={({ pressed }) => [{ flex: 1, height: 48, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', opacity: pressed || busy === m ? 0.6 : 1 }]}>
                    <Text style={[{ color: C.accent, fontWeight: '800', fontSize: 16 }, ui.num]}>{m}<Text style={{ fontSize: 12 }}> min</Text></Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                <View style={{ flex: 1 }}><Button title={session.type === 'walk' ? 'Timed walk' : info.label} icon={info.icon as never} onPress={() => start()} /></View>
                <View style={{ flex: 1 }}><Button title="Log other" kind="soft" icon="plus" onPress={() => setLogging(true)} /></View>
              </View>
              {swapped ? <Text style={{ color: C.gold, fontSize: 13 }}>{swapped}</Text> : session.note && session.outdoor ? <Text style={{ color: C.sub, fontSize: 13 }}>{session.note}</Text> : null}
              {steps != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="shoe-print" size={16} color={C.green} />
                  <Text style={{ color: C.sub, fontSize: 13 }}><Text style={{ color: C.ink, fontWeight: '700' }}>{steps.toLocaleString()}</Text> steps today from Samsung Health</Text>
                </View>
              ) : null}
              {weather ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={weatherIcon(weather) as never} size={16} color={C.faint} />
                  <Text style={{ color: C.faint, fontSize: 13 }}>Brisbane {weather.minTemp}° to {weather.maxTemp}°{weather.rainChance >= 30 ? `, ${weather.rainChance}% rain` : ''}</Text>
                </View>
              ) : null}
            </Card>
          </Appear>

          <Appear index={3}>
            <SectionTitle right={<Text style={[{ color: C.sub, fontWeight: '700' }, ui.num]}>{summary.week.total} min</Text>}>This week</SectionTitle>
            <Card style={{ gap: S.md }}>
              <Legend summary={summary} values={summary.week.by_user} />
              <WeekBars summary={summary} />
              <View style={{ flexDirection: 'row', gap: S.lg }}>
                {summary.members.map((m) => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="fire" size={18} color={summary.streaks[m.id]?.done_today ? C.gold : C.faint} />
                    <Text style={{ color: C.sub, fontSize: 13 }}>{m.name} <Text style={{ color: C.ink, fontWeight: '700' }}>{summary.streaks[m.id]?.days ?? 0} day streak</Text></Text>
                  </View>
                ))}
              </View>
            </Card>
          </Appear>

          <Appear index={4}>
            <SectionTitle right={<Pressable onPress={() => router.push('/history')}><Text style={{ color: C.accent, fontWeight: '700' }}>All</Text></Pressable>}>Recent</SectionTitle>
            <Card style={{ paddingVertical: S.xs }}>
              {summary.recent.length ? summary.recent.slice(0, 4).map((w, i) => (
                <View key={w.id} style={[ui.row, i ? { borderTopWidth: 1, borderTopColor: C.line } : null]}>
                  <IconBadge name={kindIcon(w.kind)} color={color(w.user_id)} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle} numberOfLines={1}>{w.title}</Text>
                    <Text style={ui.rowSub}>{name(w.user_id)} · {friendly(w.date)}{w.together ? ' · together' : ''}</Text>
                  </View>
                  <Text style={[{ color: C.ink, fontWeight: '700' }, ui.num]}>{w.minutes} min</Text>
                </View>
              )) : <Text style={{ color: C.sub, paddingVertical: S.md }}>Log your first walk above. Ten minutes is plenty.</Text>}
            </Card>
          </Appear>
        </View>
      </ScrollView>
      <LogSheet visible={logging} onClose={() => setLogging(false)} />
    </View>
  );
}

/** First run: meet the pet, name it, and pick where you start. */
function Welcome() {
  const { summary, apply } = useStore();
  const [color, setColor] = useState(summary?.settings.pet_color ?? PET_COLORS[0].value);
  const [petName, setPetName] = useState('');
  const me = summary?.members.find((m) => m.id === summary.me);
  const [step, setStep] = useState(String(me?.step ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!summary) return null;

  const go = async () => {
    if (!petName.trim()) { setError('Give your pet a name.'); return; }
    setBusy(true); setError(null);
    try {
      await api('/api/fit/profile', { method: 'PATCH', body: { step: Number(step) } });
      apply(await api<Summary>('/api/fit/settings', { method: 'PATCH', body: { pet_name: petName.trim(), pet_kind: 'dog', pet_color: color } }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
      <Header eyebrow="Welcome" title="Meet your pup" subtitle="You share one dog. Every day either of you moves for ten minutes, it gets fed and grows." />
      <View style={{ paddingHorizontal: S.lg, gap: S.lg }}>
        <View style={[ui.card, { alignItems: 'center' }]}>
          <Pet3D kind="dog" color={color} mood="happy" stage={0} size={210} sleepy={false} />
        </View>
        <Swatches label="Colour" value={color} colors={PET_COLORS} onChange={setColor} />
        <Field label="Name" value={petName} onChangeText={setPetName} placeholder="Mochi" maxLength={24} autoCapitalize="words" />
        <View style={{ gap: S.sm }}>
          <Chips label="Where do you want to start?" value={step} onChange={setStep}
            options={summary.steps.slice(0, 3).map((s) => ({ value: String(s.step), label: `${s.target} min walk` }))} />
          <Text style={{ color: C.sub, fontSize: 13 }}>{summary.steps.find((s) => String(s.step) === step)?.title}. Start small. The app suggests the next step once this one feels easy. Each of you picks your own.</Text>
        </View>
        {error ? <Text style={{ color: C.danger }}>{error}</Text> : null}
        <Button title="Say hello" onPress={go} busy={busy} />
      </View>
    </ScrollView>
  );
}
