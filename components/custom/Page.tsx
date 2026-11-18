import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/constants/theme';
import { useBreakpoint } from '@/hooks/useBreakpoint';

/**
 * Contenedor de pantalla: fondo, scroll, ancho maximo centrado y cabecera.
 * En escritorio el contenido no se estira a todo el ancho; en movil ocupa todo.
 */
export default function Page({
  title, subtitle, actions, children, maxWidth = 1240, scroll = true,
}: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; maxWidth?: number; scroll?: boolean }) {
  const { isDesktop } = useBreakpoint();
  const pad = isDesktop ? 32 : 16;
  const header = title ? (
    <View style={[s.header, !isDesktop && { marginBottom: 14 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, !isDesktop && { fontSize: 22 }]} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {actions}
    </View>
  ) : null;

  const inner = (
    <View style={{ width: '100%', maxWidth, alignSelf: 'center', padding: pad, flex: scroll ? undefined : 1 }}>
      {header}
      {children}
    </View>
  );
  if (!scroll) return <View style={s.root}>{inner}</View>;
  return (
    <ScrollView style={s.root} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '800', color: palette.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: palette.textMuted, marginTop: 3 },
});
