import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../lib/store';
import { api, changes, type Summary, type Workout } from '../../lib/api';
import { todaysSession, TYPE_INFO } from '../../lib/plan';
import { local } from '../../lib/local';
import { weatherIcon } from '../../lib/weather';
import { C, S, tint } from '../../lib/theme';
import { Appear } from '../../components/Appear';
import { Button, Card, Chips, ErrorBar, Field, Header, HeaderButton, Icon, IconBadge, Loading, SectionTitle, Swatches, styles as ui, tap } from '../../components/ui';
import { Legend, LogSheet, WeekBars, WorkoutRow, WorkoutSheet, accentOf } from '../../components/fit';
import { PET_COLORS, petLine } from '../../components/Pet';
import { Pet3D } from '../../components/pet3d/Pet3D';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};

export default function Home() {
  const router = useRouter();
  const { summary, error, weather, refresh, apply, planInput, color, partner, steps, imported, clearImported } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [party, setParty] = useState(0);
  const [open, setOpen] = useState<Workout | null>(null);

  const plan = useMemo(() => {
    const p = planInput();
    return p ? todaysSession(p) : null;
  }, [planInput]);

  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 5000); return () => clearTimeout(t); }, [said]);
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
  const col = accentOf(info.color);
  const showStepUp = me.can_step_up && nextStep && !local.stepUpSnoozed(summary.today);
  const line = said ?? (pet.fun < 25 && pet.mood !== 'sad' ? "I'm bored. Come play with me?" : petLine({
    name: pet.name!, mood: pet.mood, meName: me.name, partnerName: partner?.name ?? null,
    meFed: !!pet.fed[me.id], partnerFed: partner ? !!pet.fed[partner.id] : false, hour: new Date().getHours(),
  }));

  const quickLog = async (minutes: number) => {
    tap();
    setBusy(minutes);
    try {
      const r = await api<{ summary: Summary }>('/api/fit/workouts', { method: 'POST', body: { kind: 'walk', minutes, title: `${minutes} minute walk` } });
      apply(r.summary);
      changes.emit('workouts');
      setParty((n) => n + 1);
      const meAfter = r.summary.members.find((m) => m.id === r.summary.me)!;
      setSaid(meAfter.today_minutes >= meAfter.target ? `Yum! Step done for today, ${me.name}.` : `Thanks! ${meAfter.target - meAfter.today_minutes} more minutes for your step.`);
    } catch (e) { setSaid((e as Error).message); } finally { setBusy(null); }
  };
  const stepUp = async () => {
    tap();
    try { apply(await api<Summary>('/api/fit/profile', { method: 'PATCH', body: { step: me.step + 1 } })); setParty((n) => n + 1); setSaid(`Step ${me.step + 1}! So proud of you.`); } catch { /* next refresh */ }
  };
  const start = () => { tap(); router.push({ pathname: '/session', params: { type: session.type } }); };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} progressBackgroundColor={C.card} />}>
        <Header eyebrow={summary.countdown.days > 0 ? `${summary.countdown.days} days to ${summary.countdown.label}` : `${streak.days} day streak`}
          title={`${greeting()}, ${me.name}`}
          right={<HeaderButton icon="cog-outline" a11y="Settings" onPress={() => router.push('/settings')} />} />
        <ErrorBar error={error} />
        <View style={{ paddingHorizontal: S.lg, gap: S.md }}>

          {/* The dog, small. Tap through to play. */}
          <Appear index={0}>
            <Pressable onPress={() => router.push('/dog')} accessibilityRole="button" accessibilityLabel={`${pet.name}. Open to play.`}
              style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.sm, opacity: pressed ? 0.9 : 1 }]}>
              <Pet3D color={pet.color} mood={pet.mood} stage={pet.stage} wearing={pet.wearing} size={140} celebrate={party} interactive={false} />
              <View style={{ flex: 1, gap: 8, paddingRight: S.sm }}>
                <Text style={[ui.rowTitle, { fontSize: 17 }]}>{pet.name}</Text>
                <View style={{ backgroundColor: C.raised, borderRadius: 12, padding: 10 }}>
                  <Text style={{ color: C.ink, fontSize: 14 }} accessibilityLiveRegion="polite">{line}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {summary.members.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: pet.fed[m.id] ? tint(color(m.id), 0.16) : C.raised }}>
                      <Icon name={pet.fed[m.id] ? 'bowl' : 'bowl-outline'} size={14} color={pet.fed[m.id] ? color(m.id) : C.faint} />
                      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '700' }}>{m.name}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>Play, tricks and treats ›</Text>
              </View>
            </Pressable>
          </Appear>

          {/* Today: one big start button, quick walk logging, and a way to pick something else. */}
          <Appear index={1}>
            <View style={[ui.card, { gap: S.md, borderColor: tint(col, 0.5) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 5, borderColor: pct >= 1 ? C.green : C.raised, alignItems: 'center', justifyContent: 'center' }}>
                  {pct >= 1 ? <Icon name="check" size={24} color={C.green} /> : <Text style={[{ color: C.ink, fontWeight: '800', fontSize: 13 }, ui.num]}>{me.today_minutes}/{me.target}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>TODAY · STEP {me.step}</Text>
                  <Text style={ui.rowTitle}>{pct >= 1 ? `Step done, ${me.today_minutes} minutes` : `${me.target - me.today_minutes} minutes to go`}</Text>
                  <Text style={ui.rowSub}>{step.title}</Text>
                </View>
              </View>
              <Pressable onPress={start} accessibilityRole="button" accessibilityLabel={`Start ${session.title}, ${session.minutes} minutes`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: 16, backgroundColor: col, opacity: pressed ? 0.85 : 1 })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={26} color="#0B0B24" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#0B0B24', fontWeight: '800', fontSize: 17 }}>Start {session.title.toLowerCase()}</Text>
                  <Text style={{ color: '#0B0B24', opacity: 0.75, fontSize: 13 }}>{session.minutes} min, guided{session.outdoor ? ', outdoors' : ', at home'}</Text>
                </View>
              </Pressable>
              {swapped ? <Text style={{ color: C.gold, fontSize: 13 }}>{swapped}</Text> : null}
              <Button title="Choose a different workout" kind="soft" icon="view-grid-outline" onPress={() => router.push('/workouts')} />
              <View style={{ height: 1, backgroundColor: C.line }} />
              <Text style={ui.label}>Already moved? Log a walk</Text>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {[10, 15, 20, 30].map((m) => (
                  <Pressable key={m} onPress={() => quickLog(m)} disabled={busy != null} accessibilityRole="button" accessibilityLabel={`Log a ${m} minute walk`}
                    style={({ pressed }) => [{ flex: 1, height: 46, borderRadius: 12, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', opacity: pressed || busy === m ? 0.6 : 1 }]}>
                    <Text style={[{ color: C.ink, fontWeight: '800', fontSize: 15 }, ui.num]}>{m}<Text style={{ fontSize: 12, color: C.sub }}> min</Text></Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setLogging(true)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 2 }}>
                <Text style={{ color: C.accent, fontWeight: '700' }}>Log something else</Text>
              </Pressable>
              {steps != null || weather ? (
                <View style={{ flexDirection: 'row', gap: S.lg, flexWrap: 'wrap' }}>
                  {steps != null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="shoe-print" size={15} color={C.green} />
                      <Text style={{ color: C.sub, fontSize: 13 }}><Text style={{ color: C.ink, fontWeight: '700' }}>{steps.toLocaleString()}</Text> steps</Text>
                    </View>
                  ) : null}
                  {weather ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name={weatherIcon(weather) as never} size={15} color={C.faint} />
                      <Text style={{ color: C.faint, fontSize: 13 }}>{weather.minTemp}° to {weather.maxTemp}°{weather.rainChance >= 30 ? `, ${weather.rainChance}% rain` : ''}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Appear>

          {showStepUp ? (
            <Appear index={2}>
              <View style={[ui.card, { gap: S.md, borderColor: C.green }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
                  <IconBadge name="stairs-up" color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.rowTitle}>Ready for step {nextStep!.step}?</Text>
                    <Text style={ui.rowSub}>You hit your step on {me.hits_7} of the last 7 days. Next: {nextStep!.title.toLowerCase()}, {nextStep!.target} minutes.</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  <View style={{ flex: 1 }}><Button title="Step up" onPress={stepUp} /></View>
                  <View style={{ flex: 1 }}><Button title="Stay here" kind="ghost" onPress={() => { local.snoozeStepUp(summary.today); refresh(); }} /></View>
                </View>
              </View>
            </Appear>
          ) : null}

          <Appear index={3}>
            <SectionTitle right={<Text style={[{ color: C.sub, fontWeight: '700' }, ui.num]}>{summary.week.total} min</Text>}>This week</SectionTitle>
            <Card style={{ gap: S.md }}>
              <Legend summary={summary} values={summary.week.by_user} />
              <WeekBars summary={summary} />
              <View style={{ flexDirection: 'row', gap: S.lg }}>
                {summary.members.map((m) => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="fire" size={18} color={summary.streaks[m.id]?.done_today ? C.gold : C.faint} />
                    <Text style={{ color: C.sub, fontSize: 13 }}>{m.name} <Text style={{ color: C.ink, fontWeight: '700' }}>{summary.streaks[m.id]?.days ?? 0} days</Text></Text>
                  </View>
                ))}
              </View>
            </Card>
          </Appear>

          <Appear index={4}>
            <SectionTitle right={<Pressable onPress={() => router.push('/history')}><Text style={{ color: C.accent, fontWeight: '700' }}>All</Text></Pressable>}>Recent</SectionTitle>
            <Card style={{ paddingVertical: S.xs }}>
              {summary.recent.length ? summary.recent.slice(0, 5).map((w, i) => (
                <WorkoutRow key={w.id} w={w} first={i === 0} onPress={() => setOpen(w)} />
              )) : <Text style={{ color: C.sub, paddingVertical: S.md }}>Log your first walk above. Ten minutes is plenty.</Text>}
            </Card>
            {summary.recent.length ? <Text style={{ color: C.faint, fontSize: 12, marginTop: 6, paddingHorizontal: S.xs }}>Tap a session to see it or delete it.</Text> : null}
          </Appear>
        </View>
      </ScrollView>
      <LogSheet visible={logging} onClose={() => setLogging(false)} onSaved={() => setParty((n) => n + 1)} />
      <WorkoutSheet workout={open} onClose={() => setOpen(null)} />
    </View>
  );
}

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
