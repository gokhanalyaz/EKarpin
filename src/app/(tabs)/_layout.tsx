import { Tabs } from 'expo-router/js-tabs';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';

/** Alt menu (Zara/Netflix tarzi sade sekme cubugu): marka rengi sadece
 * butonlarda kaliyor, navigasyon tamamen monokrom - aktif sekme koyu/dolu
 * ikon, pasif sekme gri/bos ikonla ayirt ediliyor. */
export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? Colors.dark : Colors.light;
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
        tabBarLabelStyle: { fontFamily: FontFamily.bodySemiBold, fontSize: 11 },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ focused, color, size }) => (
            <SymbolView name={focused ? 'house.fill' : 'house'} size={size} tintColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Geçmiş',
          tabBarIcon: ({ focused, color, size }) => (
            <SymbolView name={focused ? 'clock.fill' : 'clock'} size={size} tintColor={color} />
          ),
        }}
      />
      <Tabs.Protected guard={isOwner}>
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Bildirimler',
            tabBarIcon: ({ focused, color, size }) => (
              <SymbolView name={focused ? 'bell.fill' : 'bell'} size={size} tintColor={color} />
            ),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="account"
        options={{
          title: 'Hesabım',
          tabBarIcon: ({ focused, color, size }) => (
            <SymbolView
              name={focused ? 'person.crop.circle.fill' : 'person.crop.circle'}
              size={size}
              tintColor={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
