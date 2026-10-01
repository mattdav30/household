import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Profile } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, Chips, Field, Icon, styles as ui } from '../components/ui';
import { C, S } from '../lib/theme';

type Mode = 'signin' | 'create' | 'join';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [home, setHome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = mode === 'signin'
        ? await api<{ token: string } & Profile>('/auth/login', { method: 'POST', body: { email, password } })
        : await api<{ token: string } & Profile>('/auth/register', {
          method: 'POST',
          body: { email, password, name, ...(mode === 'join' ? { invite_code: code } : { household_name: home }) },
        });
      const { token, ...profile } = res;
      await signIn(token, profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingTop: insets.top + 60, gap: S.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="home-heart" size={32} color={C.onAccent} />
        </View>
        <View>
          <Text style={ui.h1}>Household</Text>
          <Text style={[ui.headerSub, { fontSize: 16 }]}>Lists, meals, plans and bills for the two of you.</Text>
        </View>

        <Chips<Mode> value={mode} onChange={(m) => { setMode(m); setError(null); }} options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'create', label: 'New household' },
          { value: 'join', label: 'Join with code' },
        ]} />

        {mode !== 'signin' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="Matt" autoCapitalize="words" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="8 or more characters" secureTextEntry autoComplete={mode === 'signin' ? 'password' : 'new-password'} />
        {mode === 'create' ? <Field label="Household name" value={home} onChangeText={setHome} placeholder="Home" /> : null}
        {mode === 'join' ? (
          <Field label="Invite code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="6 letters, from Settings on the other phone" autoCapitalize="characters" maxLength={6} />
        ) : null}

        {error ? <Text style={{ color: C.danger, fontSize: 14 }}>{error}</Text> : null}
        <Button title={mode === 'signin' ? 'Sign in' : mode === 'create' ? 'Create household' : 'Join household'} onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
