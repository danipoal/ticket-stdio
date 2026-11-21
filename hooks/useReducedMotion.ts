import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** true si la persona ha pedido menos animaciones (ajuste del sistema / del navegador). */
export default function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => on && setReduced(!!v))
      .catch(() => {});
    const sub: any = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => on && setReduced(!!v));
    return () => {
      on = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
