import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CircleAlert, LogOut, RefreshCw, Ticket } from 'lucide-react-native';
import { HOME_ROUTE, LOGIN_ROUTE, PROFILE_ROUTE } from '@/utils/authRouting';
import useReducedMotion from '@/hooks/useReducedMotion';

/**
 * Pantalla de carga de marca mientras la app decide a donde llevarte: comprueba la sesion, carga la ficha de empleado
 * (la empresa) y redirige. Sustituye al spinner suelto sobre fondo blanco. Es la misma imagen que el HTML previo al
 * JavaScript (app/+html.tsx), asi que del primer pixel a la app no hay saltos ni pantalla en blanco.
 */
export type BootStage = 'session' | 'organization' | 'redirect' | 'error';
export type StepState = 'done' | 'active' | 'pending' | 'error';
export type BootStep = { key: 'session' | 'organization' | 'panel'; label: string; state: StepState };

/** Texto de estado (en castellano, en gerundio: es una accion en curso). */
export function bootLabel(stage: BootStage, target?: string | null): string {
  switch (stage) {
    case 'session':
      return 'Comprobando tu sesión…';
    case 'organization':
      return 'Cargando tu empresa…';
    case 'redirect':
      if (target === HOME_ROUTE) return 'Abriendo tu panel…';
      if (target === PROFILE_ROUTE) return 'Preparando tu perfil…';
      return 'Un momento…';
    case 'error':
      return 'No hemos podido cargar tu empresa';
  }
}

/** Pasos Sesion -> Empresa -> Panel. Sin sesion (se va al login) no tiene sentido enseñarlos. */
export function bootSteps(stage: BootStage, target?: string | null, hasSession = true): BootStep[] {
  if (stage === 'redirect' && target === LOGIN_ROUTE && !hasSession) return [];
  const step = (key: BootStep['key'], label: string, state: StepState): BootStep => ({ key, label, state });
  switch (stage) {
    case 'session':
      return [step('session', 'Sesión', 'active'), step('organization', 'Empresa', 'pending'), step('panel', 'Panel', 'pending')];
    case 'organization':
      return [step('session', 'Sesión', 'done'), step('organization', 'Empresa', 'active'), step('panel', 'Panel', 'pending')];
    case 'error':
      return [step('session', 'Sesión', 'done'), step('organization', 'Empresa', 'error'), step('panel', 'Panel', 'pending')];
    case 'redirect':
      // Sin ficha de empleado la empresa aun esta por resolver (completar perfil); con ella, solo queda abrir el panel
      return target === PROFILE_ROUTE
        ? [step('session', 'Sesión', 'done'), step('organization', 'Empresa', 'active'), step('panel', 'Panel', 'pending')]
        : [step('session', 'Sesión', 'done'), step('organization', 'Empresa', 'done'), step('panel', 'Panel', 'active')];
  }
}

type Props = {
  /** true mientras hay que mostrarla; al pasar a false se desvanece y se desmonta. */
  active: boolean;
  stage: BootStage;
  target?: string | null;
  hasSession?: boolean;
  /** Lleva demasiado tiempo: se explica y se ofrecen salidas. */
  slow?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
};

const FADE_MS = 240;
const fixed: any = Platform.OS === 'web' ? { position: 'fixed' } : { position: 'absolute' };

export default function BootSplash({ active, stage, target, hasSession = true, slow, onRetry, onSignOut }: Props) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(active);
  // En web el HTML estatico ya lleva su propio splash (#boot): React no pinta el suyo hasta hidratar (asi no hay dos ni desajuste de hidratacion)
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');
  useEffect(() => setHydrated(true), []);

  // Entrada inmediata; salida con desvanecimiento
  useEffect(() => {
    if (active) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    if (reduced) {
      setMounted(false);
      return;
    }
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: false }).start(({ finished }) => finished && setMounted(false));
  }, [active, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // Anillo que late alrededor del logo
  useEffect(() => {
    if (reduced || !mounted) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [reduced, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quita el splash del HTML (app/+html.tsx) cuando este ya esta pintado: es identico, no se nota el cambio
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !hydrated || !mounted) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('boot')?.remove()));
    return () => cancelAnimationFrame(id);
  }, [hydrated, mounted]);

  if (!mounted || !hydrated) return null;

  const steps = bootSteps(stage, target, hasSession);
  const label = bootLabel(stage, target);
  const failed = stage === 'error';
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Animated.View
      testID="boot-splash"
      style={[s.root, fixed, { opacity }]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <View style={s.blobA} />
      <View style={s.blobB} />

      <View style={s.center}>
        <View style={s.logoWrap}>
          {!reduced && !failed ? <Animated.View style={[s.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} /> : null}
          <View style={[s.logo, failed && { backgroundColor: '#b91c1c' }]}>
            {failed ? <CircleAlert size={30} color="#fff" /> : <Ticket size={30} color="#fff" />}
          </View>
        </View>
        <Text style={s.brand}>Ticket Stdio</Text>

        <View style={s.status}>
          {failed ? null : <ActivityIndicator size="small" color="#a5b4fc" />}
          <Text testID="boot-label" style={s.label}>{label}</Text>
        </View>

        {steps.length > 0 ? (
          <View style={s.steps} testID="boot-steps">
            {steps.map((st, i) => (
              <View key={st.key} style={s.stepWrap}>
                {i > 0 ? <View style={[s.line, (st.state === 'done' || st.state === 'active' || st.state === 'error') && s.lineOn]} /> : null}
                <View style={s.step} testID={`boot-step-${st.key}`} accessibilityState={{ selected: st.state === 'active' }}>
                  <View style={[s.dot, st.state === 'done' && s.dotDone, st.state === 'active' && s.dotActive, st.state === 'error' && s.dotError]}>
                    {st.state === 'done' ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <Text style={[s.stepText, st.state !== 'pending' && s.stepTextOn, st.state === 'error' && { color: '#fca5a5' }]}>{st.label}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {failed || slow ? (
          <View style={s.help} testID="boot-help">
            <Text style={s.helpText}>
              {failed ? 'Comprueba tu conexión e inténtalo de nuevo. Tus datos no se han perdido.' : 'Esto está tardando más de lo normal. Puede que la conexión sea lenta.'}
            </Text>
            <View style={s.actions}>
              {onRetry ? (
                <Pressable testID="boot-retry" accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [s.btn, s.btnPrimary, pressed && { opacity: 0.85 }]}>
                  <RefreshCw size={15} color="#fff" />
                  <Text style={s.btnText}>Reintentar</Text>
                </Pressable>
              ) : null}
              {onSignOut ? (
                <Pressable testID="boot-signout" accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [s.btn, s.btnGhost, pressed && { opacity: 0.85 }]}>
                  <LogOut size={15} color="#e5e7eb" />
                  <Text style={[s.btnText, { color: '#e5e7eb' }]}>Cerrar sesión</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blobA: { position: 'absolute', width: 520, height: 520, borderRadius: 260, backgroundColor: '#4f46e5', opacity: 0.32, top: -190, right: -170 },
  blobB: { position: 'absolute', width: 440, height: 440, borderRadius: 220, backgroundColor: '#0891b2', opacity: 0.2, bottom: -170, left: -130 },
  center: { alignItems: 'center', paddingHorizontal: 24, maxWidth: 420, width: '100%' },
  logoWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: 24, borderWidth: 2, borderColor: '#818cf8' },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  label: { color: '#9ca3af', fontSize: 15, fontWeight: '500' },
  steps: { flexDirection: 'row', alignItems: 'center', marginTop: 30 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  step: { alignItems: 'center', gap: 7, width: 64 },
  line: { width: 34, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 20 },
  lineOn: { backgroundColor: '#6366f1' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  dotActive: { borderColor: '#a5b4fc', backgroundColor: 'rgba(99,102,241,0.35)' },
  dotError: { borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.25)' },
  stepText: { color: '#6b7280', fontSize: 12.5, fontWeight: '600' },
  stepTextOn: { color: '#e5e7eb' },
  help: { marginTop: 32, alignItems: 'center', gap: 16 },
  helpText: { color: '#cbd5e1', fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 11 },
  btnPrimary: { backgroundColor: '#4f46e5' },
  btnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});
