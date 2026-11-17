import { Alert, Platform } from 'react-native';

/**
 * Pide confirmacion antes de una accion destructiva.
 * En web Alert.alert no hace nada (nunca llama a los botones), asi que se usa
 * window.confirm; en movil, Alert.alert con Cancelar/Eliminar.
 */
export function confirmAction(title: string, message: string, confirmLabel = 'Eliminar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(`${title}\n\n${message}`)
      : false;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
