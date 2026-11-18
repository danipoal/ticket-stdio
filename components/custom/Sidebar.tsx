import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Home, Ticket, Settings, User, LogOut, ClipboardCheck } from 'lucide-react-native';
import { palette } from '@/constants/theme';
import useAuth from '@/context/useAuth';
import { supabase } from '@/utils/supabase';
import { initials } from '@/utils/dashboard';
import { Avatar } from './ui';

const ICONS: Record<string, any> = { home: Home, tickets: Ticket, approvals: ClipboardCheck, settings: Settings, user: User };

/** Barra de navegacion lateral para escritorio (sustituye a la barra inferior). */
export default function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { employee, user } = useAuth();

  const logOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={s.root} testID="sidebar">
      <View style={s.brand}>
        <View style={s.logo}><Ticket size={18} color="#fff" /></View>
        <Text style={s.brandText}>Ticket Stdio</Text>
      </View>

      <View style={{ flex: 1, marginTop: 8 }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // expo-router traduce `href: null` en tabBarItemStyle.display = 'none'
          // (el prop href no llega a las opciones): asi se oculta una pestaña.
          const hidden = (options as any).href === null || (options.tabBarItemStyle as any)?.display === 'none';
          if (hidden) return null;
          const focused = state.index === index;
          const Icon = ICONS[route.name] ?? Home;
          const label = (options.title as string) ?? route.name;
          return (
            <Pressable
              key={route.key}
              testID={`nav-${route.name}`}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
              }}
              style={({ hovered }: any) => [s.item, focused && s.itemActive, hovered && !focused && s.itemHover]}
            >
              <Icon size={19} color={focused ? '#fff' : palette.sidebarText} />
              <Text style={[s.itemText, focused && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.userBox}>
        <Avatar text={initials(employee?.name)} size={38} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.userName} numberOfLines={1}>{employee?.name ?? 'Usuario'}</Text>
          <Text style={s.userMail} numberOfLines={1}>{user?.email ?? ''}</Text>
        </View>
        <Pressable testID="nav-logout" onPress={logOut} accessibilityLabel="Cerrar sesión" hitSlop={8}>
          <LogOut size={18} color={palette.sidebarText} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { width: 248, backgroundColor: palette.sidebar, paddingVertical: 20, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 18 },
  logo: { width: 32, height: 32, borderRadius: 9, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#fff', fontSize: 17, fontWeight: '800', marginLeft: 10, letterSpacing: -0.3 },
  item: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 4 },
  itemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.05)' },
  itemText: { color: palette.sidebarText, fontSize: 14.5, fontWeight: '600', marginLeft: 12 },
  userBox: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14, paddingHorizontal: 4 },
  userName: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  userMail: { color: palette.sidebarText, fontSize: 11.5, marginTop: 1 },
});
