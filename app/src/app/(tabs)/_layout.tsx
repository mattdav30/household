import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../components/ui';
import { C } from '../../lib/theme';

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarIcon: ({ focused }: { focused: boolean }) => <Icon name={focused ? iconOn : icon} color={focused ? C.accent : C.sub} size={24} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.sub,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, height: 64 + 0, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'white-balance-sunny', 'white-balance-sunny')} />
      <Tabs.Screen name="shopping" options={tab('Shopping', 'cart-outline', 'cart')} />
      <Tabs.Screen name="meals" options={tab('Meals', 'silverware-fork-knife', 'silverware-fork-knife')} />
      <Tabs.Screen name="calendar" options={tab('Calendar', 'calendar-blank-outline', 'calendar-blank')} />
      <Tabs.Screen name="more" options={tab('More', 'dots-horizontal-circle-outline', 'dots-horizontal-circle')} />
    </Tabs>
  );
}
