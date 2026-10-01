import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, styles as ui } from './ui';
import { C, S } from '../lib/theme';

export function BackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + S.sm, paddingHorizontal: S.lg, paddingBottom: S.md }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))} hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -6, marginBottom: S.xs }}>
        <Icon name="chevron-left" color={C.accent} />
        <Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.h1}>{title}</Text>
          {subtitle ? <Text style={ui.headerSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}
