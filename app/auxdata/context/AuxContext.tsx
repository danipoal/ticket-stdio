import React, { createContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/utils/supabase";
import useAuth from "@/app/auth/context/useAuth";

type SimpleItem = { id: number | string; name: string };

type AuxContextType = {
  sheetStatuses: SimpleItem[];
  paymentTypes: SimpleItem[];
  categories: SimpleItem[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export const AuxContext = createContext<AuxContextType | undefined>(undefined);

const AuxProvider = ({ children }: { children: ReactNode }) => {
  const [sheetStatuses, setSheetStatuses] = useState<SimpleItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<SimpleItem[]>([]);
  const [categories, setCategories] = useState<SimpleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { employee, user, loading: authLoading } = useAuth();

  const refresh = async () => {
    setLoading(true);
    try {
      // Solo cargar si hay usuario autenticado y empleado válido
      if (!user || !employee?.id) {
        setSheetStatuses([]);
        setPaymentTypes([]);
        setCategories([]);
        setLoading(false);
        return;
      }
      const [stRes, payRes, catRes] = await Promise.all([
        supabase.from("Sheet_status").select("*").order("name", { ascending: true }),
        supabase.from("Expense_payment_type").select("*").order("name", { ascending: true }),
        supabase.from("Expense_category").select("*").order("name", { ascending: true }),
      ]);

      if (!stRes.error) setSheetStatuses(stRes.data || []);
      if (!payRes.error) setPaymentTypes(payRes.data || []);
      if (!catRes.error) setCategories(catRes.data || []);
    } catch (e) {
      console.error("Error cargando datos auxiliares", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ejecutar solo cuando Auth haya terminado y haya sesión + empleado
    if (!authLoading && user && employee?.id) {
      refresh();
    } else if (!authLoading) {
      setSheetStatuses([]);
      setPaymentTypes([]);
      setCategories([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, employee?.id]);

  return (
    <AuxContext.Provider value={{ sheetStatuses, paymentTypes, categories, loading, refresh }}>
      {children}
    </AuxContext.Provider>
  );
};

export default AuxProvider;
