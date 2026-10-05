import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/ui';
import { C } from '../../lib/theme';

const tab = (title: string, icon: IconName, iconOn: IconName) => ({
  title,
  tabBarIcon: ({ focused }: { focused: boolean }) => (
    <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.accentSoft : 'transparent' }}>
      <Icon name={focused ? iconOn : icon} color={focused ? C.accent : C.sub} size={22} />
    </View>
  ),
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: C.sub,
        tabBarStyle: { backgroundColor: C.tabBar, borderTopColor: C.line, borderTopWidth: 1, height: 68 + insets.bottom, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'white-balance-sunny', 'white-balance-sunny')} />
      <Tabs.Screen name="train" options={tab('Train', 'dumbbell', 'dumbbell')} />
      <Tabs.Screen name="journey" options={tab('Journey', 'map-outline', 'map')} />
      <Tabs.Screen name="progress" options={tab('Progress', 'chart-line', 'chart-line')} />
    </Tabs>
  );
}
