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
import { Platform } from "react-native";
import BootSplash, { BootStage } from "@/components/custom/BootSplash";
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
  // Fase de la carga inicial para la pantalla de carga: primero la sesion, despues la ficha de empleado (la empresa)
  const [phase, setPhase] = useState<"session" | "organization">("session");
  // La ficha no se pudo cargar por un error (red, servidor): NO es lo mismo que "no tiene ficha" y no debe mandar a completar el perfil
  const [employeeError, setEmployeeError] = useState(false);
  const [slow, setSlow] = useState(false);
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
      setEmployeeError(true);
      return null;
    }
    setEmployeeError(false);
    setEmployee(data ?? null);
    return data ?? null;
    } catch (e) {
      console.error("Error fetching employee data:", e);
      setEmployee(null);
      setEmployeeError(true);
      return null;
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
        if (initial?.user) {
          setPhase("organization");
          await fetchEmployee(initial.user.id);
        }
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
      setEmployeeError(false);
      setCheckedFor(null);
      return;
    }
    fetchEmployee(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A donde hay que llevar al usuario ahora mismo (null = ya esta en un sitio valido). Se calcula en cada render para que la
  // pantalla de carga cubra tambien el instante entre "decidido" y "navegado" (antes se veia un instante la pantalla equivocada).
  const waitingEmployee = !loading && !!userId && checkedFor !== userId;
  const target =
    !loading && navState?.key && !waitingEmployee && !employeeError
      ? routeForState({ pathname, hasSession: !!userId, hasEmployee: !!employee })
      : null;

  // Guardia de rutas
  useEffect(() => {
    if (loading || !navState?.key) return;
    if (userId && checkedFor !== userId) return; // aun consultando el empleado
    if (employeeError) return; // fallo de red: se pide reintentar, no se decide por el usuario
    if (target) router.replace(target as any);
  }, [loading, navState?.key, pathname, userId, checkedFor, employee?.id, employeeError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Etapa que enseña la pantalla de carga (null = ninguna)
  let stage: BootStage | null = null;
  if (loading) stage = phase;
  else if (employeeError && userId) stage = "error";
  else if (waitingEmployee) stage = "organization";
  else if (target) stage = "redirect";

  // Si la espera se alarga, se explica y se ofrecen salidas
  const waiting = stage !== null && stage !== "error";
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [waiting]);

  // Se recuerda la ultima etapa para no cambiar el texto mientras la pantalla se desvanece
  const lastStage = useRef<BootStage>("session");
  const lastTarget = useRef<string | null>(null);
  if (stage) lastStage.current = stage;
  if (target) lastTarget.current = target;

  const reload = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.location.reload();
  };
  const retry = () => {
    if (!userId) return reload();
    setEmployeeError(false);
    setCheckedFor(null); // vuelve a "consultando la empresa"
    fetchEmployee(userId);
  };
  const signOut = () => {
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, employee, loading, fetchEmployee, setEmployee }}
    >
      {/* Durante la carga inicial no se monta la app: aun no se sabe quien es el usuario */}
      {loading ? null : children}
      <BootSplash
        active={stage !== null}
        stage={stage ?? lastStage.current}
        target={target ?? lastTarget.current}
        hasSession={!!userId}
        slow={slow}
        onRetry={stage === "error" ? retry : reload}
        onSignOut={userId ? signOut : undefined}
      />
    </AuthContext.Provider>
  );
};

export default AuthProvider;
