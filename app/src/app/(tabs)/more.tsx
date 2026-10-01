import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Header, Icon, styles as ui, type IconName } from '../../components/ui';
import { C, S } from '../../lib/theme';

const ITEMS: { icon: IconName; title: string; sub: string; href: string }[] = [
  { icon: 'broom', title: 'Chores and reminders', sub: 'Repeating jobs, who does what', href: '/chores' },
  { icon: 'receipt-text-outline', title: 'Bills', sub: 'Due dates and amounts', href: '/bills' },
  { icon: 'gift-outline', title: 'Wish lists', sub: 'Wants, needs and gift ideas', href: '/lists' },
  { icon: 'book-open-variant', title: 'Recipes', sub: 'Saved meals and ingredients', href: '/recipes' },
  { icon: 'cog-outline', title: 'Settings', sub: 'Profile, invite code, sign out', href: '/settings' },
];

export default function More() {
  const router = useRouter();
  return (
    <View style={{ flex: 1 }}>
      <Header title="More" />
      <ScrollView contentContainerStyle={ui.list}>
        <Card style={{ paddingVertical: S.xs }}>
          {ITEMS.map((it, i) => (
            <View key={it.href}>
              {i ? <View style={ui.sep} /> : null}
              <Pressable onPress={() => router.push(it.href as never)} style={({ pressed }) => [ui.row, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={it.icon} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ui.rowTitle}>{it.title}</Text>
                  <Text style={ui.rowSub}>{it.sub}</Text>
                </View>
                <Icon name="chevron-right" color={C.faint} />
              </Pressable>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
