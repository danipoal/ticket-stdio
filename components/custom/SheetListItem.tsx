import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Folder, Trash2, User } from 'lucide-react-native';
import { palette, statusStyle } from '@/constants/theme';
import { ExpenseSheet } from '@/constants/types';
import { formatAmount, formatDateSafe } from '@/utils/format';
import { IconButton, StatusBadge } from './ui';

/** Fila de la lista de hojas (escritorio): barra de color por estado, importe y metadatos con icono. */
export default function SheetListItem({
  sheet, selected, onPress, onDelete, ownerName,
}: { sheet: ExpenseSheet; selected?: boolean; onPress?: () => void; onDelete?: (s: ExpenseSheet) => void; ownerName?: string }) {
  const st = statusStyle(sheet.status?.id);
  // El boton de borrar es hermano (no hijo) del boton principal: un <button> dentro de
  // otro <button> es HTML invalido y React lo avisa en la consola.
  return (
    <View style={[s.item, selected && s.selected]}>
      <View style={[s.accent, { backgroundColor: st.fg }]} />
      <Pressable
        testID="sheet-open"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        style={({ hovered }: any) => [s.main, hovered && !selected && s.hover]}
      >
        <View style={s.top}>
          <Text style={s.title} numberOfLines={1}>{sheet.title}</Text>
          <Text style={s.amount}>{formatAmount(sheet.total_amount)} €</Text>
        </View>
        {sheet.reference ? <Text style={s.ref}>{sheet.reference}</Text> : null}
        <View style={s.meta}>
          {ownerName ? (
            <View style={s.metaItem}><User size={13} color={palette.textMuted} /><Text style={s.metaText} numberOfLines={1}>{ownerName}</Text></View>
          ) : null}
          <View style={s.metaItem}><Folder size={13} color={palette.textMuted} /><Text style={s.metaText} numberOfLines={1}>{sheet.project || 'Sin proyecto'}</Text></View>
          <View style={s.metaItem}><CalendarDays size={13} color={palette.textMuted} /><Text style={s.metaText}>{formatDateSafe(sheet.create_date)}</Text></View>
        </View>
        <View style={s.footer}>
          <StatusBadge statusId={sheet.status?.id} label={sheet.status?.name} />
        </View>
      </Pressable>
      {onDelete ? (
        <View style={s.del}>
          <IconButton testID="sheet-delete" onPress={() => onDelete?.(sheet)} label="Eliminar hoja" danger>
            <Trash2 size={16} color={palette.textMuted} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  item: {
    backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#1e1b4b', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  main: { paddingVertical: 14, paddingLeft: 18, paddingRight: 14 },
  del: { position: 'absolute', right: 8, bottom: 8 },
  selected: { borderColor: palette.primary, backgroundColor: palette.primarySoft, shadowOpacity: 0.12, shadowRadius: 14 },
  hover: { backgroundColor: '#f8f8ff' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: palette.text, marginRight: 10 },
  amount: { fontSize: 16, fontWeight: '800', color: palette.text, fontVariant: ['tabular-nums'] },
  ref: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.5, color: palette.textMuted, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  metaText: { fontSize: 12.5, color: palette.textMuted, flexShrink: 1 },
  footer: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
});
