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
import { ensurePermission } from '../lib/notify';
import { applyUpdate, checkForUpdates, installRelease, installedVersion, runningSince } from '../lib/appUpdates';
import { connectHealth, healthState, openHealthSettings, type HealthState } from '../lib/health';
import { Card, Chips, DateField, Field, Icon, SectionTitle, Swatches, Button, styles as ui, tap } from '../components/ui';
import { PET_COLORS } from '../components/Pet';
import { Pet3D, pet3dStatus } from '../components/pet3d/Pet3D';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, apply } = useStore();
  const { signOut } = useSession();
  const [quiet, setQuiet] = useState(local.quiet());
  const [voice, setVoice] = useState(local.voice());
  const [petName, setPetName] = useState(summary?.settings.pet_name ?? '');
  const [countdown, setCountdown] = useState(summary?.settings.countdown_label ?? '');
  const { syncNow } = useStore();
  const [hState, setHState] = useState<HealthState>('unsupported');
  const [healthOn, setHealthOn] = useState(local.health());
  const [healthMsg, setHealthMsg] = useState<string | null>(null);
  useEffect(() => { healthState().then(setHState); }, []);
  // Fill the text fields once the data arrives.
  const petNameSaved = summary?.settings.pet_name ?? '';
  const countdownSaved = summary?.settings.countdown_label ?? '';
  useEffect(() => { setPetName(petNameSaved); }, [petNameSaved]);
  useEffect(() => { setCountdown(countdownSaved); }, [countdownSaved]);
  const [updMsg, setUpdMsg] = useState<string | null>(null);
  const [updAction, setUpdAction] = useState<null | (() => void)>(null);
  const checkUpdates = async () => {
    tap();
    setUpdMsg('Checking…'); setUpdAction(null);
    const s = await checkForUpdates();
    if (s.release) { setUpdMsg(`Tandem ${s.release.version} is ready to install.`); setUpdAction(() => () => installRelease(s.release!)); }
    else if (s.otaReady) { setUpdMsg('An update is downloaded and ready.'); setUpdAction(() => applyUpdate); }
    else setUpdMsg('You have the latest version.');
  };
  const since = runningSince();
  const [status3d, setStatus3d] = useState(pet3dStatus);
  useEffect(() => { const t = setInterval(() => setStatus3d(pet3dStatus), 1500); return () => clearInterval(t); }, []);
  const toggleHealth = async (on: boolean) => {
    tap();
    if (!on) { local.setHealth(false); setHealthOn(false); setHealthMsg(null); return; }
    if (hState !== 'ready') { openHealthSettings(); return; }
    try {
      const ok = await connectHealth();
      setHealthOn(ok);
      if (!ok) { setHealthMsg('Allow Steps and Exercise in the Health Connect screen to turn this on.'); return; }
      setHealthMsg('Connected. Syncing now…');
      const added = await syncNow();
      setHealthMsg(added ? `Connected. Added ${added} ${added === 1 ? 'session' : 'sessions'} from the last two weeks.` : 'Connected. New walks and workouts will appear as Samsung Health records them.');
    } catch (e) { setHealthMsg((e as Error).message); }
  };

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
  const step = summary.steps.find((s) => s.step === me.step)!;

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
        <View style={{ gap: S.sm }}>
          <Chips label="Your step" value={String(me.step)} onChange={(v) => save('/api/fit/profile', { step: Number(v) })}
            options={summary.steps.map((s) => ({ value: String(s.step), label: `${s.step}` }))} />
          <Text style={{ color: C.sub, fontSize: 13 }}>{step.title}, {step.target} minutes a day. Step down any time a week feels too much.</Text>
        </View>
        <Chips label="Morning reminder" value={me.reminder_hour == null ? 'off' : String(me.reminder_hour)}
          onChange={async (v) => { if (v !== 'off') await ensurePermission(); save('/api/fit/profile', { reminder_hour: v === 'off' ? null : Number(v) }); }}
          options={[{ value: 'off', label: 'Off' }, { value: '5', label: '5am' }, { value: '6', label: '6am' }, { value: '7', label: '7am' }, { value: '8', label: '8am' }, { value: '12', label: 'Noon' }]} />
        <Toggle title="6pm nudge" sub="Only on days you have not moved yet" value={me.evening_nudge}
          onChange={async (v) => { if (v) await ensurePermission(); save('/api/fit/profile', { evening_nudge: v }); }} />
        <Toggle title="Quiet mode" sub="No jumping moves. For late nights and neighbours." value={quiet} onChange={(v) => { setQuiet(v); local.setQuiet(v); }} />
        <Toggle title="Spoken cues" sub="Reads out each move during guided sessions" value={voice} onChange={(v) => { setVoice(v); local.setVoice(v); }} />
        <Toggle title="Light theme" sub="Restarts the app" value={MODE === 'light'} onChange={(v) => setMode(v ? 'light' : 'dark')} />
      </Card>

      <SectionTitle>Samsung Health</SectionTitle>
      <Card style={{ gap: S.md }}>
        <Toggle title="Sync with Samsung Health" sub="Walks and workouts it records log here on their own, plus today's steps" value={healthOn} onChange={toggleHealth} />
        {hState === 'unsupported' ? <Text style={{ color: C.sub, fontSize: 13 }}>Available on Android phones.</Text> : null}
        {hState === 'install' || hState === 'update' ? (
          <Text style={{ color: C.gold, fontSize: 13 }}>{hState === 'install' ? 'Install Health Connect from the Play Store first, then come back.' : 'Update Health Connect from the Play Store first, then come back.'}</Text>
        ) : null}
        {healthMsg ? <Text style={{ color: C.sub, fontSize: 13 }}>{healthMsg}</Text> : null}
        <Text style={{ color: C.faint, fontSize: 12, lineHeight: 18 }}>
          In Samsung Health, open Settings, then Health Connect, and turn on sharing for Steps and Exercise. On phones without Samsung Health, any app that shares to Health Connect works too.
        </Text>
        {healthOn ? <Button title="Sync now" kind="soft" icon="sync" onPress={async () => { tap(); const n = await syncNow(); setHealthMsg(n ? `Added ${n} new ${n === 1 ? 'session' : 'sessions'}.` : 'Up to date.'); }} /> : null}
      </Card>

      <SectionTitle>Your pet</SectionTitle>
      <Card style={{ gap: S.lg }}>
        <View style={{ alignItems: 'center' }}>
          <Pet3D kind="dog" color={summary.settings.pet_color} mood="happy" stage={summary.pet.stage} size={170} sleepy={false} />
          <Text style={{ color: C.faint, fontSize: 11 }}>3D: {status3d}</Text>
        </View>
        <Field label="Name" value={petName} onChangeText={setPetName} maxLength={24}
          onEndEditing={() => petName.trim() && save('/api/fit/settings', { pet_name: petName.trim() })} />
        <Swatches label="Colour" value={summary.settings.pet_color} colors={PET_COLORS} onChange={(v) => save('/api/fit/settings', { pet_color: v })} />
      </Card>

      <SectionTitle>Shared by both of you</SectionTitle>
      <Card style={{ gap: S.lg }}>
        <View style={{ gap: S.sm }}>
          <Field label="Counting down to" value={countdown} onChangeText={setCountdown} placeholder="the wedding"
            onEndEditing={() => countdown.trim() && save('/api/fit/settings', { countdown_label: countdown.trim() })} />
          <DateField label="Countdown date" value={summary.settings.wedding_date} onChange={(d) => d && save('/api/fit/settings', { wedding_date: d })} />
          <Text style={{ color: C.sub, fontSize: 13 }}>Shows at the top of Home until the day arrives. After the wedding, point it at the next big thing.</Text>
        </View>
        <View style={{ gap: S.sm }}>
          <Text style={ui.label}>Equipment at home</Text>
          {EQUIPMENT.map((e) => (
            <Toggle key={e.value} title={e.label} sub={e.note} value={equipment.has(e.value)} onChange={() => toggleEquip(e.value)} />
          ))}
        </View>
      </Card>

      <SectionTitle>App</SectionTitle>
      <Card style={{ gap: S.md }}>
        <Text style={ui.rowTitle}>Tandem {installedVersion()}</Text>
        <Text style={ui.rowSub}>{since ? `Latest changes from ${since.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ${since.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}` : 'Running the code from the install file'}</Text>
        {updMsg ? <Text style={{ color: C.sub, fontSize: 13 }}>{updMsg}</Text> : null}
        {updAction ? <Button title={updMsg?.includes('install') ? 'Install' : 'Restart now'} onPress={updAction} /> : <Button title="Check for updates" kind="soft" icon="refresh" onPress={checkUpdates} />}
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
