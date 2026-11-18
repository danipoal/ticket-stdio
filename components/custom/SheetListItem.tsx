import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { palette } from '@/constants/theme';
import { ExpenseSheet } from '@/constants/types';
import { formatAmount, formatDateSafe } from '@/utils/format';
import { StatusBadge } from './ui';

/** Fila compacta de la lista de hojas (escritorio). */
export default function SheetListItem({
  sheet, selected, onPress, onDelete, ownerName,
}: { sheet: ExpenseSheet; selected?: boolean; onPress?: () => void; onDelete?: (s: ExpenseSheet) => void; ownerName?: string }) {
  // El boton de borrar es hermano (no hijo) del boton principal: un <button> dentro de
  // otro <button> es HTML invalido y React lo avisa en la consola.
  return (
    <View style={[s.item, selected && s.selected]}>
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
        <Text style={s.sub} numberOfLines={1}>
          {sheet.reference ? `${sheet.reference} · ` : ''}{ownerName ? `${ownerName} · ` : ''}{sheet.project || 'Sin proyecto'} · {formatDateSafe(sheet.create_date)}
        </Text>
        <StatusBadge statusId={sheet.status?.id} label={sheet.status?.name} />
      </Pressable>
      {onDelete ? (
      <Pressable
        testID="sheet-delete"
        onPress={() => onDelete?.(sheet)}
        accessibilityLabel="Eliminar hoja"
        accessibilityRole="button"
        hitSlop={8}
        style={s.del}
      >
        <Trash2 size={16} color={palette.textMuted} />
      </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  item: { backgroundColor: palette.surface, borderRadius: 12, borderWidth: 1, borderColor: palette.border, marginBottom: 10 },
  main: { padding: 14, borderRadius: 12 },
  del: { position: 'absolute', right: 14, bottom: 14 },
  selected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  hover: { borderColor: '#c7cbf7' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: palette.text, marginRight: 8 },
  amount: { fontSize: 14.5, fontWeight: '800', color: palette.text },
  sub: { fontSize: 12.5, color: palette.textMuted, marginTop: 3, marginBottom: 10 },
});
