import { SheetStatusID } from './constants';

// Paleta de la app (indigo + neutros). Los estados tienen color propio.
export const palette = {
  bg: '#f4f5f9',
  surface: '#ffffff',
  border: '#e5e7ee',
  text: '#111827',
  textMuted: '#6b7280',
  primary: '#4f46e5',
  primarySoft: '#eef0ff',
  sidebar: '#111827',
  sidebarText: '#9ca3af',
  success: '#16a34a',
  successSoft: '#dcfce7',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  info: '#0891b2',
};

export const chartColors = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#9ca3af'];

export function statusStyle(statusId?: number | null) {
  switch (statusId) {
    case SheetStatusID.APROBADO:
      return { fg: palette.success, bg: palette.successSoft, label: 'Aprobado' };
    case SheetStatusID.RECHAZADO:
      return { fg: palette.danger, bg: palette.dangerSoft, label: 'Rechazado' };
    case SheetStatusID.PENDIENTE:
      return { fg: palette.warning, bg: palette.warningSoft, label: 'Pendiente' };
    default:
      return { fg: palette.textMuted, bg: '#f3f4f6', label: 'Sin estado' };
  }
}
