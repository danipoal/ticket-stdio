import { SheetHistoryEntry } from '@/constants/types';
import { SheetStatusID } from '@/constants/constants';

/** Texto de un movimiento del historial: "Creada", "Aprobada", "Rechazada" o "Reenviada a aprobación". */
export function historyLabel(h: Pick<SheetHistoryEntry, 'from_status' | 'to_status'>): string {
  if (h.from_status === null || h.from_status === undefined) return 'Creada';
  switch (h.to_status) {
    case SheetStatusID.APROBADO: return 'Aprobada';
    case SheetStatusID.RECHAZADO: return 'Rechazada';
    case SheetStatusID.PENDIENTE: return 'Reenviada a aprobación';
    default: return 'Cambio de estado';
  }
}

/** Mensaje claro para los errores de las funciones de alta (join_organization / organization_by_code). */
export function friendlyJoinError(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('codigo de empresa no valido') || m.includes('código de empresa no válido')) return 'Código de empresa no válido';
  if (m.includes('ya tienes un perfil')) return 'Ya tienes un perfil creado';
  if (m.includes('introduce tu nombre')) return 'Introduce tu nombre';
  if (m.includes('iniciar sesion') || m.includes('jwt')) return 'Tu sesión ha caducado. Vuelve a iniciar sesión';
  return 'No se pudo completar el alta. Inténtalo de nuevo';
}
