import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Banner } from '@/components/custom/ui';
import { palette } from '@/constants/theme';
import { BillingStatus, limitLevel, limitMessage } from '@/utils/billing';

/**
 * Aviso del cupo de tickets gratuitos: avisa a TODA la empresa cuando quedan pocos y bloquea (con explicacion) cuando se agotan.
 * Quien administra la cuenta ve ademas el acceso directo a la pestaña Suscripcion.
 */
export default function QuotaBanner({ status, isAdmin }: { status: BillingStatus | null; isAdmin: boolean }) {
  const router = useRouter();
  const level = limitLevel(status);
  if (!status || level === 'ok') return null;
  return (
    <View style={s.wrap} testID={level === 'blocked' ? 'quota-blocked' : 'quota-low'}>
      <Banner tone={level === 'blocked' ? 'danger' : 'warning'}>{limitMessage(status, isAdmin)}</Banner>
      {isAdmin ? (
        <Pressable testID="quota-manage" accessibilityRole="link" onPress={() => router.push('/subscription' as any)} style={s.link}>
          <Text style={s.linkText}>Ir a Suscripción →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12, gap: 4 },
  link: { alignSelf: 'flex-start', paddingVertical: 2 },
  linkText: { fontSize: 13.5, fontWeight: '700', color: palette.primary },
});
