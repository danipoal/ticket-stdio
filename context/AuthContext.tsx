import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/utils/supabase";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import { Spinner } from '@/components/ui/spinner/index';
import { EmployeePlain } from "@/constants/types";
import { routeForState } from "@/utils/authRouting";

type AuthContextType = {
  session: Session | null;
  user: Session["user"] | null;
  employee: EmployeePlain | null;
  loading: boolean;
  fetchEmployee: (userId?: string) => Promise<EmployeePlain | null>;
  setEmployee: (e: EmployeePlain | null) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeePlain | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const navState = useRootNavigationState();
  // Id del usuario cuya ficha de empleado ya se ha consultado. Mientras no
  // coincida con el usuario actual no sabemos si tiene perfil o no, y el
  // guardia de rutas no debe decidir (si no, un login normal pasaria un
  // instante por /auth/completeProfile).
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const fetchEmployee = useCallback(async (userId?: string): Promise<EmployeePlain | null> => {
    const id = userId ?? sessionRef.current?.user?.id;
    if (!id) return null;
    try {
    // maybeSingle: un usuario recien registrado aun no tiene fila en employees
    // y .single() lo trataba como un error.
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id_user", id)
      .maybeSingle();
    if (error) {
      console.error("Error fetching employee data:", error.message);
      setEmployee(null);
      return null;
    }
    setEmployee(data ?? null);
    return data ?? null;
    } finally {
      setCheckedFor(id);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // supabase-js (v2) ejecuta el callback de onAuthStateChange dentro de su
    // lock interno: hacer await a otra llamada de supabase desde ahi puede
    // bloquearse. Por eso aqui solo guardamos la sesion y cargamos el empleado
    // en un efecto aparte.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next ?? null);
    });

    (async () => {
      try {
        const { data: { session: initial } } = await supabase.auth.getSession();
        if (!active) return;
        setSession(initial ?? null);
        if (initial?.user) await fetchEmployee(initial.user.id);
      } catch (e) {
        console.error("Error iniciando la sesion", e);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchEmployee]);

  // Cuando cambia el usuario (login / logout / refresh de otro usuario) se
  // recarga o se limpia el empleado.
  const userId = session?.user?.id;
  useEffect(() => {
    if (loading) return;
    if (!userId) {
      setEmployee(null);
      setCheckedFor(null);
      return;
    }
    fetchEmployee(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardia de rutas
  useEffect(() => {
    if (loading || !navState?.key) return;
    if (userId && checkedFor !== userId) return; // aun consultando el empleado
    const target = routeForState({ pathname, hasSession: !!userId, hasEmployee: !!employee });
    if (target) router.replace(target as any);
  }, [loading, navState?.key, pathname, userId, checkedFor, employee?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, employee, loading, fetchEmployee, setEmployee }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
