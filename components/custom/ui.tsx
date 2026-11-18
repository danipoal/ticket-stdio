import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle, Pressable } from 'react-native';
import { palette, statusStyle } from '@/constants/theme';

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

export function CardTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={s.cardTitleRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        {subtitle ? <Text style={s.muted}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function StatusBadge({ statusId, label }: { statusId?: number | null; label?: string }) {
  const st = statusStyle(statusId);
  return (
    <View style={[s.badge, { backgroundColor: st.bg }]} testID="status-badge">
      <View style={[s.dot, { backgroundColor: st.fg }]} />
      <Text style={[s.badgeText, { color: st.fg }]}>{label || st.label}</Text>
    </View>
  );
}

export function Avatar({ text, size = 36, color = palette.primary }: { text: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{text}</Text>
    </View>
  );
}

export function Chip({ label, count, active, onPress, testID }: { label: string; count?: number; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: palette.primary }]}>{label}</Text>
      {count !== undefined ? <Text style={[s.chipCount, active && { color: palette.primary }]}>{count}</Text> : null}
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, testID, icon }: { label: string; onPress?: () => void; testID?: string; icon?: React.ReactNode }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}>
      {icon}
      <Text style={s.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export const text = {
  h1: { fontSize: 26, fontWeight: '800', color: palette.text } as TextStyle,
  muted: { fontSize: 13, color: palette.textMuted } as TextStyle,
};

const s = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 18 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: palette.text },
  muted: { fontSize: 12.5, color: palette.textMuted, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  chipActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  chipText: { fontSize: 13, fontWeight: '600', color: palette.textMuted },
  chipCount: { fontSize: 12, color: palette.textMuted, marginLeft: 6 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
