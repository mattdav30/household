import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { api, type Summary } from '../lib/api';
import { local } from '../lib/local';
import { EQUIPMENT, type Equip } from '../lib/exercises';
import { C, MODE, S, setMode } from '../lib/theme';
import { money, toCents } from '../lib/dates';
import { ensurePermission } from '../lib/notify';
import { Button, Card, Chips, DateField, Field, Icon, SectionTitle, styles as ui, tap } from '../components/ui';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, apply } = useStore();
  const { signOut } = useSession();
  const [quiet, setQuiet] = useState(local.quiet());
  const [voice, setVoice] = useState(local.voice());
  const [goal, setGoal] = useState('');
  const [rate, setRate] = useState('');
  const [jarGoal, setJarGoal] = useState('');
  const [jarLabel, setJarLabel] = useState(summary?.settings.jar_label ?? '');
  const [countdown, setCountdown] = useState(summary?.settings.countdown_label ?? '');
  const [journeyName, setJourneyName] = useState(summary?.journey?.title ?? '');

  useEffect(() => {
    if (!summary) return;
    setGoal(String(summary.settings.weekly_goal_min));
    setRate((summary.settings.jar_cents / 100).toFixed(2));
    setJarGoal(String(Math.round(summary.settings.jar_goal_cents / 100)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.settings.weekly_goal_min, summary?.settings.jar_cents, summary?.settings.jar_goal_cents]);

  if (!summary) return null;
  const me = summary.members.find((m) => m.id === summary.me)!;
  const save = (path: string, body: Record<string, unknown>) =>
    api<Summary>(path, { method: 'PATCH', body }).then(apply).catch((e) => Alert.alert('That did not save', (e as Error).message));
  const equipment = new Set(summary.settings.equipment);
  const toggleEquip = (e: Equip) => {
    tap();
    const next = new Set(equipment);
    if (next.has(e)) next.delete(e); else next.add(e);
    save('/api/fit/settings', { equipment: [...next] });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: S.lg, paddingTop: insets.top + S.md, paddingBottom: insets.bottom + 60, gap: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={[ui.closeBtn, { width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="arrow-left" color={C.sub} />
        </Pressable>
        <Text style={ui.h1}>Settings</Text>
      </View>

      <SectionTitle>Just you, {me.name}</SectionTitle>
      <Card style={{ gap: S.lg }}>
        <Chips label="Starting level" value={String(me.level)} onChange={(v) => save('/api/fit/profile', { level: Number(v) })}
          options={[{ value: '1', label: 'Easy start' }, { value: '2', label: 'Steady' }, { value: '3', label: 'Strong' }]} />
        <Text style={{ color: C.sub, fontSize: 13, marginTop: -S.sm }}>Workouts also get a little harder each week on their own.</Text>
        <Chips label="Morning reminder" value={me.reminder_hour == null ? 'off' : String(me.reminder_hour)}
          onChange={async (v) => { if (v !== 'off') await ensurePermission(); save('/api/fit/profile', { reminder_hour: v === 'off' ? null : Number(v) }); }}
          options={[{ value: 'off', label: 'Off' }, { value: '5', label: '5am' }, { value: '6', label: '6am' }, { value: '7', label: '7am' }, { value: '12', label: 'Noon' }, { value: '17', label: '5pm' }, { value: '18', label: '6pm' }]} />
        <Toggle title="Quiet mode" sub="No jumping moves. For late nights and neighbours." value={quiet} onChange={(v) => { setQuiet(v); local.setQuiet(v); }} />
        <Toggle title="Spoken cues" sub="Reads out each move during workouts" value={voice} onChange={(v) => { setVoice(v); local.setVoice(v); }} />
        <Toggle title="Light theme" sub="Restarts the app" value={MODE === 'light'} onChange={(v) => setMode(v ? 'light' : 'dark')} />
      </Card>

      <SectionTitle>Shared by both of you</SectionTitle>
      <Card style={{ gap: S.lg }}>
        <View style={{ gap: S.sm }}>
          <Field label="Weekly goal, minutes combined" value={goal} onChangeText={(t) => setGoal(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
            onEndEditing={() => Number(goal) >= 30 && save('/api/fit/settings', { weekly_goal_min: Number(goal) })} />
          <Text style={{ color: C.sub, fontSize: 13 }}>300 minutes is 150 each, the weekly amount health guidelines suggest for adults. This also sets the pace of each journey.</Text>
        </View>
        <View style={{ gap: S.sm }}>
          <Text style={ui.label}>Equipment at home</Text>
          {EQUIPMENT.map((e) => (
            <Toggle key={e.value} title={e.label} sub={e.note} value={equipment.has(e.value)} onChange={() => toggleEquip(e.value)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: S.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Fund per day moved" value={rate} onChangeText={setRate} keyboardType="decimal-pad"
              onEndEditing={() => { const c = toCents(rate); if (c != null) save('/api/fit/settings', { jar_cents: c }); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Fund goal, $" value={jarGoal} onChangeText={(t) => setJarGoal(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
              onEndEditing={() => Number(jarGoal) > 0 && save('/api/fit/settings', { jar_goal_cents: Number(jarGoal) * 100 })} />
          </View>
        </View>
        <Text style={{ color: C.sub, fontSize: 13, marginTop: -S.sm }}>Currently {money(summary.settings.jar_cents)} a day each, towards {money(summary.settings.jar_goal_cents)} for {summary.jar.label}.</Text>
        <Field label="What the fund is for" value={jarLabel} onChangeText={setJarLabel}
          onEndEditing={() => jarLabel.trim() && save('/api/fit/settings', { jar_label: jarLabel.trim() })} />
        <View style={{ gap: S.sm }}>
          <Field label="Counting down to" value={countdown} onChangeText={setCountdown} placeholder="the wedding"
            onEndEditing={() => countdown.trim() && save('/api/fit/settings', { countdown_label: countdown.trim() })} />
          <DateField label="Countdown date" value={summary.settings.wedding_date} onChange={(d) => d && save('/api/fit/settings', { wedding_date: d })} />
          <Text style={{ color: C.sub, fontSize: 13 }}>Shows on Today until the day arrives. Point it at the next big thing after the wedding, like the honeymoon or a fun run.</Text>
        </View>
        {summary.journey ? (
          <View style={{ gap: S.sm }}>
            <Field label="Current journey name" value={journeyName} onChangeText={setJourneyName}
              onEndEditing={() => journeyName.trim() && save('/api/fit/journey', { title: journeyName.trim() })} />
            <DateField label="Current journey ends" value={summary.journey.end_date} onChange={(d) => d && save('/api/fit/journey', { end_date: d })} />
          </View>
        ) : null}
      </Card>

      <Button title="Sign out" kind="danger" onPress={() => Alert.alert('Sign out?', 'Your progress photos stay on this phone.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ])} />
    </ScrollView>
  );
}

function Toggle({ title, sub, value, onChange }: { title: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <View style={{ flex: 1 }}>
        <Text style={ui.rowTitle}>{title}</Text>
        {sub ? <Text style={ui.rowSub}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={title} />
    </View>
  );
}
