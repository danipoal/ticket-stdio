export type ExpenseSheetPlain = {
  id?: number;
  title: string;
  description: string;
  project: string;
  total_amount?: string;
  create_date?: string | null;
  approval_date: string | null;
  id_user: string;
  id_status: string;
};

export type ExpenseLinePlain = {
  id?: number;
  created_at?: string | null;
  title: string;
  amount?: number;
  date?: string | null;
  tax: number;
  foto?: string;
  /** Ruta en el bucket privado `tickets` (se abre con una URL firmada). `foto` queda para URLs externas antiguas. */
  foto_path?: string | null;
  id_payment_type: string;	
  id_category: string;
  id_sheet: string;
}

export type OrganizationPlain = {
  id: string;
  name: string;
  VAT_number: string;
  street: string;
  city: string;
  country: string;
  // otros campos que tengas
};

export type EmployeePlain = {
  id: string | null;
  name: string | null;
  is_admin: boolean | null;
  id_organization: string | null;
  id_user: string | null;
};

export type ExpenseSheet = {
  id: number;
  /** HG-000012: la genera la base de datos */
  reference?: string;
  review_note?: string | null;
  reviewed_at?: string | null;
  title: string;
  description: string;
  project: string;
  total_amount: string;
  create_date: string;
  approval_date: string;
  id_user: string;
  status: SheetStatus;
};

export type SheetStatus = {
    id: number;
    name: string;
}

export type DashboardStats = {
  id_user: string;
  name: string;
  id_admin: string;
  total_expense_sheets: number;
  approved_sheets: number;
  pending_sheets: number;
  denied_sheets: number;
  total_expense_lines: number;
  total_amount: number;
};

export type SheetHistoryEntry = {
  id: number;
  id_sheet: number;
  from_status: number | null;
  to_status: number;
  changed_by_name: string | null;
  note: string | null;
  changed_at: string;
};
