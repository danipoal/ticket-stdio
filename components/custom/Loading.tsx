import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { palette } from '@/constants/theme';
import useReducedMotion from '@/hooks/useReducedMotion';

/** Estado de carga de una zona de la app: indicador de marca + texto (ej. "Cargando tickets..."). Sustituye al texto suelto. */
export function LoadingState({ label, testID, compact }: { label: string; testID?: string; compact?: boolean }) {
  return (
    <View
      testID={testID ?? 'loading-state'}
      style={[s.state, compact && { paddingVertical: 16 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="small" color={palette.primary} />
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

/** Bloque gris que late (marcador de contenido que aun no ha llegado). Sin animacion si la persona pidio menos movimiento. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const opacity = reduced ? 0.7 : v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return <Animated.View style={[s.skeleton, style, { opacity }]} />;
}

/** Esqueleto de la lista de hojas (misma forma que SheetListItem) mientras cargan. Lleva su texto accesible. */
export function SheetListSkeleton({ count = 4, label = 'Cargando...' }: { count?: number; label?: string }) {
  return (
    <View testID="sheet-list-skeleton" accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={s.card}>
          <View style={s.cardTop}>
            <Skeleton style={{ height: 15, width: `${48 + ((i * 13) % 30)}%` }} />
            <Skeleton style={{ height: 15, width: 64 }} />
          </View>
          <Skeleton style={{ height: 11, width: 84, marginTop: 8 }} />
          <View style={s.cardMeta}>
            <Skeleton style={{ height: 11, width: 70 }} />
            <Skeleton style={{ height: 11, width: 82 }} />
          </View>
          <Skeleton style={{ height: 22, width: 86, borderRadius: 999, marginTop: 12 }} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 36 },
  label: { fontSize: 14, color: palette.textMuted, fontWeight: '500' },
  skeleton: { backgroundColor: '#e3e6f0', borderRadius: 6 },
  card: { backgroundColor: palette.surface, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { flexDirection: 'row', gap: 14, marginTop: 10 },
});
