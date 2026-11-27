import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { HeaderActions } from '@/components/HeaderActions';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: theme === 'dark' ? '#94a3b8' : '#64748b',
        tabBarStyle: {
          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
          borderTopColor: theme === 'dark' ? '#334155' : '#e2e8f0',
          height: 68,
          paddingTop: 7,
          paddingBottom: 7,
        },
        headerStyle: {
          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
        },
        headerTintColor: theme === 'dark' ? '#e2e8f0' : '#1e293b',
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
        headerRight: () => <HeaderActions />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="income"
        options={{
          title: 'Receitas',
          tabBarIcon: ({ color }) => <Ionicons name="wallet" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Despesas',
          tabBarIcon: ({ color }) => <Ionicons name="cash" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color }) => <Ionicons name="card" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mais',
          tabBarIcon: ({ color }) => <Ionicons name="menu" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="accounts" options={{ href: null }} />
      <Tabs.Screen name="cash-movements" options={{ href: null }} />
      <Tabs.Screen
        name="investments"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="review"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="cards"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="statements"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notification-lab"
        options={{
          title: 'Ferramentas de desenvolvimento',
          href: null,
        }}
      />
    </Tabs>
  );
}
