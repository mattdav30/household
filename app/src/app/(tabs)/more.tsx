import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Header, Icon, IconBadge, styles as ui, type IconName } from '../../components/ui';
import { C, S } from '../../lib/theme';

const ITEMS: { icon: IconName; color: string; title: string; sub: string; href: string }[] = [
  { icon: 'broom', color: '#5B8DEF', title: 'Chores and reminders', sub: 'Repeating jobs, who does what', href: '/chores' },
  { icon: 'receipt-text-outline', color: '#F2875E', title: 'Bills', sub: 'Due dates and amounts', href: '/bills' },
  { icon: 'gift-outline', color: '#EC6FA8', title: 'Wish lists', sub: 'Wants, needs and gift ideas', href: '/lists' },
  { icon: 'book-open-variant', color: '#E8B931', title: 'Recipes', sub: 'Saved, discover and import', href: '/recipes' },
  { icon: 'fridge-outline', color: '#34C08A', title: 'At home', sub: 'What we already have', href: '/shopping?view=home' },
  { icon: 'cog-outline', color: '#8C9A95', title: 'Settings', sub: 'Appearance, invite code, sign out', href: '/settings' },
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
                <IconBadge name={it.icon} color={it.color} />
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
