import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import useAuth from '@/context/useAuth';
import type { BillingStatus } from '@/utils/billing';

/**
 * Estado de la suscripcion / cupo de tickets de la empresa del usuario.
 * Si la RPC no existe o falla (p. ej. la migracion aun no esta aplicada) devuelve `status: null` y la app funciona sin limite.
 */
export default function useBilling() {
  const { employee } = useAuth();
  const employeeId = employee?.id;
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<BillingStatus | null> => {
    if (!employeeId) {
      setStatus(null);
      setLoading(false);
      return null;
    }
    const { data, error } = await supabase.rpc('billing_status');
    const next = !error && data ? (data as BillingStatus) : null;
    setStatus(next);
    setLoading(false);
    return next;
  }, [employeeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, refresh };
}
