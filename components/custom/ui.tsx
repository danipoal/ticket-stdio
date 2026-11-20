import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle, Pressable } from 'react-native';
import { Info, CheckCircle2, XCircle, Clock } from 'lucide-react-native';
import { chartColors, palette, statusStyle } from '@/constants/theme';

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


/** Color estable para una categoria (mismo id, mismo color en toda la app). */
export function categoryColor(key: string | number | null | undefined): string {
  const n = key === null || key === undefined || key === '' ? NaN : Number(key);
  if (!Number.isFinite(n)) return chartColors[chartColors.length - 1];
  return chartColors[Math.abs(Math.trunc(n)) % (chartColors.length - 1)];
}

/** Pastilla de categoria con punto de color. */
export function CategoryPill({ name, colorKey }: { name?: string | null; colorKey?: string | number | null }) {
  if (!name) return <Text style={s.mutedDash}>-</Text>;
  const c = categoryColor(colorKey);
  return (
    <View style={[s.pill, { backgroundColor: c + '1a' }]}>
      <View style={[s.dot, { backgroundColor: c, marginRight: 6 }]} />
      <Text style={[s.pillText, { color: palette.text }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

/** Dato destacado de la cabecera (icono + etiqueta + valor). `highlight` resalta el total. */
export function StatTile({ icon, label, value, highlight, testID }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={[s.stat, highlight && s.statHighlight]}>
      {icon ? <View style={[s.statIcon, highlight && { backgroundColor: palette.primary }]}>{icon}</View> : null}
      <View style={{ flexShrink: 1 }}>
        <Text style={[s.statLabel, highlight && { color: palette.primary }]}>{label}</Text>
        <Text style={[s.statValue, highlight && { color: palette.primary, fontSize: 18 }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const TONES = {
  info: { bg: '#eef2ff', fg: '#3730a3', border: '#c7d2fe', Icon: Info },
  warning: { bg: palette.warningSoft, fg: '#92400e', border: '#fde68a', Icon: Clock },
  danger: { bg: palette.dangerSoft, fg: '#991b1b', border: '#fecaca', Icon: XCircle },
  success: { bg: palette.successSoft, fg: '#166534', border: '#bbf7d0', Icon: CheckCircle2 },
} as const;

/** Aviso con icono y color segun el tono. */
export function Banner({ tone = 'info', children, testID }: { tone?: keyof typeof TONES; children: React.ReactNode; testID?: string }) {
  const t = TONES[tone];
  return (
    <View testID={testID} style={[s.banner, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <t.Icon size={16} color={t.fg} style={{ marginTop: 1 }} />
      <Text style={[s.bannerText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/** Estado vacio: icono grande en circulo, titulo y pista de que hacer. */
export function EmptyState({ icon, title, hint, testID }: { icon?: React.ReactNode; title: string; hint?: string; testID?: string }) {
  return (
    <View testID={testID} style={s.empty}>
      {icon ? <View style={s.emptyIcon}>{icon}</View> : null}
      <Text style={s.emptyTitle}>{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

/** Boton de icono con fondo al pasar el raton; `danger` lo tiñe de rojo. */
export function IconButton({ children, onPress, label, testID, danger }: { children: React.ReactNode; onPress?: () => void; label: string; testID?: string; danger?: boolean }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ hovered, pressed }: any) => [s.iconBtn, (hovered || pressed) && (danger ? s.iconBtnDanger : s.iconBtnHover)]}
    >
      {children}
    </Pressable>
  );
}

export const text = {
  h1: { fontSize: 26, fontWeight: '800', color: palette.text } as TextStyle,
  muted: { fontSize: 13, color: palette.textMuted } as TextStyle,
};

const s = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 18, shadowColor: '#1e1b4b', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
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
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, maxWidth: '100%' },
  pillText: { fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  mutedDash: { fontSize: 13.5, color: palette.textMuted },
  stat: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.bg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexGrow: 1, flexBasis: 140, maxWidth: 260 },
  statHighlight: { backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: '#d9dcff' },
  statIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#e2e4f0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  statLabel: { fontSize: 11.5, color: palette.textMuted, fontWeight: '600' },
  statValue: { fontSize: 15, color: palette.text, fontWeight: '700', marginTop: 1 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, gap: 8 },
  bannerText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: palette.text, textAlign: 'center' },
  emptyHint: { fontSize: 13, color: palette.textMuted, marginTop: 4, textAlign: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconBtnHover: { backgroundColor: palette.primarySoft },
  iconBtnDanger: { backgroundColor: palette.dangerSoft },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
