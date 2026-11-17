import { ExpenseLinePlain, ExpenseSheetPlain } from '@/constants/types';
import { isValidIsoDate, parseDecimal } from './format';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export const MIN_PASSWORD_LENGTH = 6; // minimo por defecto de Supabase Auth

export type LineInput = {
  title: string;
  amount: string;
  tax: string;
  date: string | null;
  idPaymentType: string;
  idCategory: string;
  idSheet: string | number;
  foto?: string;
};

export type LineValidation =
  | { ok: true; payload: ExpenseLinePlain }
  | { ok: false; errors: Partial<Record<keyof LineInput, string>> };

/** Valida el formulario de una linea de gasto y construye el payload para Supabase. */
export function validateLine(input: LineInput): LineValidation {
  const errors: Partial<Record<keyof LineInput, string>> = {};

  const title = input.title.trim();
  if (!title) errors.title = 'El título es obligatorio';

  const amount = parseDecimal(input.amount);
  if (amount === null) errors.amount = 'Introduce un importe válido (ej. 12,50)';
  else if (amount <= 0) errors.amount = 'El importe debe ser mayor que 0';

  let tax = 0;
  if (input.tax.trim() !== '') {
    const parsed = parseDecimal(input.tax);
    if (parsed === null) errors.tax = 'IVA no válido';
    else if (parsed < 0 || parsed > 100) errors.tax = 'El IVA debe estar entre 0 y 100';
    else tax = parsed;
  }

  if (input.date && !isValidIsoDate(input.date)) {
    errors.date = 'Fecha no válida (formato AAAA-MM-DD)';
  }
  if (!input.idPaymentType) errors.idPaymentType = 'Selecciona un tipo de pago';
  if (!input.idCategory) errors.idCategory = 'Selecciona una categoría';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      title,
      amount: Math.round((amount as number) * 100) / 100,
      date: input.date || null,
      tax,
      foto: input.foto?.trim() || undefined,
      id_payment_type: input.idPaymentType,
      id_category: input.idCategory,
      id_sheet: String(input.idSheet),
    },
  };
}

export type SheetInput = {
  title: string;
  description: string;
  project: string;
  approvalDate: string | null;
  idUser: string | null | undefined;
  idStatus: string;
};

export type SheetValidation =
  | { ok: true; payload: ExpenseSheetPlain }
  | { ok: false; errors: Partial<Record<keyof SheetInput, string>> };

export function validateSheet(input: SheetInput): SheetValidation {
  const errors: Partial<Record<keyof SheetInput, string>> = {};
  if (!input.title.trim()) errors.title = 'El título es obligatorio';
  if (!input.project.trim()) errors.project = 'El proyecto es obligatorio';
  if (input.approvalDate && !isValidIsoDate(input.approvalDate)) {
    errors.approvalDate = 'Fecha no válida';
  }
  if (!input.idUser) errors.idUser = 'No se ha podido identificar al empleado';
  if (!input.idStatus) errors.idStatus = 'Falta el estado inicial';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      title: input.title.trim(),
      description: input.description.trim(),
      project: input.project.trim(),
      approval_date: input.approvalDate || null,
      id_user: input.idUser as string,
      id_status: input.idStatus,
    },
  };
}
