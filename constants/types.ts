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