import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Profile } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, Field, Icon, styles as ui } from '../components/ui';
import { C, S } from '../lib/theme';


export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const { token, ...profile } = await api<{ token: string } & Profile>('/auth/login', { method: 'POST', body: { email, password } });
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
          <Icon name="paw" size={32} color={C.onAccent} />
        </View>
        <View>
          <Text style={ui.h1}>Tandem</Text>
          <Text style={[ui.headerSub, { fontSize: 16 }]}>Small steps together, with a pet to look after.</Text>
        </View>
        <View style={[ui.card, { flexDirection: 'row', gap: S.md, alignItems: 'center' }]}>
          <Icon name="home-heart" color={C.accent} />
          <Text style={{ color: C.sub, flex: 1, lineHeight: 20 }}>Sign in with your own Household email and password. You both share the same pet automatically.</Text>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your Household password" secureTextEntry autoComplete="password" />
        {error ? <Text style={{ color: C.danger, fontSize: 14 }}>{error}</Text> : null}
        <Button title="Sign in" onPress={submit} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
