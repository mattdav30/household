import { useEffect, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { api, type Profile } from '../lib/api';
import { useSession } from '../lib/session';
import { BackHeader } from '../components/BackHeader';
import { Button, Card, Chips, Field, SectionTitle, Segmented, styles as ui } from '../components/ui';
import { C, MEMBER_COLORS, MODE, S, setMode, vivid, type Mode } from '../lib/theme';

const COLORS = MEMBER_COLORS;

export default function Settings() {
  const { profile, refresh, signOut } = useSession();
  const [name, setName] = useState(profile?.user.name ?? '');
  const [home, setHome] = useState(profile?.household.name ?? '');
  const [color, setColor] = useState(vivid(profile?.user.color) ?? COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) { setName(profile.user.name); setHome(profile.household.name); setColor(vivid(profile.user.color)); }
  }, [profile]);

  async function save() {
    setBusy(true);
    try {
      await api<Profile>('/api/me', { method: 'PATCH', body: { name, color, household_name: home } });
      await refresh();
      Alert.alert('Saved');
    } catch (e) { Alert.alert('Could not save', (e as Error).message); } finally { setBusy(false); }
  }

  async function checkUpdate() {
    setUpdateMsg('Checking…');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) { setUpdateMsg('You have the latest version.'); return; }
      setUpdateMsg('Downloading update…');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      setUpdateMsg(`Update check failed: ${(e as Error).message}`);
    }
  }

  if (!profile) return null;
  const code = profile.household.invite_code;

  return (
    <View style={{ flex: 1 }}>
      <BackHeader title="Settings" />
      <ScrollView contentContainerStyle={[ui.list, { gap: S.sm }]} keyboardShouldPersistTaps="handled">
        <SectionTitle>Invite</SectionTitle>
        <Card style={{ gap: S.md }}>
          <Text style={ui.rowSub}>On the other phone, open the app, choose Join with code and enter:</Text>
          <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6, color: C.accent, textAlign: 'center' }}>{code}</Text>
          <Text style={ui.rowSub}>In this household: {profile.members.map((m) => m.name).join(' and ')}</Text>
          <Button kind="ghost" icon="share-variant" title="Share code" onPress={() => Share.share({ message: `Join our Household app with code ${code}` })} />
        </Card>

        <SectionTitle>You</SectionTitle>
        <Card style={{ gap: S.lg }}>
          <Field label="Your name" value={name} onChangeText={setName} />
          <Chips label="Your colour" value={color} onChange={setColor} options={COLORS.map((c) => ({ value: c, label: '   ', color: c }))} />
          <Field label="Household name" value={home} onChangeText={setHome} />
          <Text style={ui.rowSub}>Signed in as {profile.user.email}</Text>
          <Button title="Save" onPress={save} busy={busy} />
        </Card>

        <SectionTitle>Appearance</SectionTitle>
        <Card style={{ gap: S.md }}>
          <Segmented<Mode> value={MODE} onChange={(m) => { if (m !== MODE) setMode(m); }} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
          <Text style={ui.rowSub}>The app restarts to switch. Each phone keeps its own choice.</Text>
        </Card>

        <SectionTitle>App</SectionTitle>
        <Card style={{ gap: S.md }}>
          <Text style={ui.rowSub}>Version {Constants.expoConfig?.version}{Updates.updateId ? ` · update ${Updates.updateId.slice(0, 8)}` : ''}</Text>
          <Text style={[ui.rowSub, { fontSize: 11 }]}>Updates {Updates.isEnabled ? 'on' : 'off'}, channel {Updates.channel ?? 'none'}, runtime {Updates.runtimeVersion ?? 'none'}, {Updates.isEmbeddedLaunch ? 'built-in code' : 'downloaded update'}</Text>
          <Button kind="ghost" icon="cloud-download-outline" title="Check for updates" onPress={checkUpdate} />
          {updateMsg ? <Text style={[ui.rowSub, { textAlign: 'center' }]}>{updateMsg}</Text> : null}
          <View style={ui.sep} />
          <Button kind="danger" icon="logout" title="Sign out" onPress={() => Alert.alert('Sign out?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: signOut }])} />
        </Card>
      </ScrollView>
    </View>
  );
}
