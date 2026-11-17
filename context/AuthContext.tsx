import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/utils/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter, useFocusEffect } from "expo-router";
import { Spinner } from '@/components/ui/spinner/index';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EmployeePlain } from "@/constants/types";


type AuthContextType = {
  session: Session | null;
  user: Session["user"] | null;
  employee: EmployeePlain | null;
  loading: boolean;
  fetchEmployee: (userId?: string) => Promise<any>;
  setEmployee: (e: EmployeePlain | null) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeePlain | null>(null);
  
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    console.log("Init Auth")
    initAuth();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        if (!session?.user) router.replace("/auth/login");
        // else if (!employee) router.replace("/auth/completeProfile");
      }
    }, [loading, session?.user, employee])
  );


  const initAuth = async () => {

    await initFromStorage();
    
    console.log("Auth no storage, intentando obtenerlo")
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session ?? null);
    if (session?.user) {
      await fetchEmployee(session.user.id);
    } else {
      setEmployee(null);
    }
    setLoading(false);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session ?? null);
      if (session?.user) {
        await fetchEmployee(session.user.id);
        await AsyncStorage.setItem("session", JSON.stringify(session));
      } else {
        setEmployee(null);
        await AsyncStorage.removeItem("session");
        await AsyncStorage.removeItem("employee");
      }
    });

    // Guardamos los datos si los tenemos
    if (session) await AsyncStorage.setItem("session", JSON.stringify(session));
    if (employee) await AsyncStorage.setItem("employee", JSON.stringify(employee));

    return () => subscription.unsubscribe();
  }

  const initFromStorage = async () => {
    try {
      // Intenta leer del AsyncStorage
      const storedSession = await AsyncStorage.getItem("session");
      const storedEmployee = await AsyncStorage.getItem("employee");

      if (storedSession) {
        setSession(JSON.parse(storedSession));
      }
      if (storedEmployee) {
        setEmployee(JSON.parse(storedEmployee));
      }

      // No hacemos early return: siempre validamos con Supabase
      return false;
    } catch (error) {
      console.error("Error intendando leer los datos de session en Async")
      return false;
    }

  }

  const fetchEmployee = async (userId?: string) => {
    const id = userId ?? session?.user?.id;
    if (id) {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id_user", id)
        .single();

      if (error) {
        console.error("Error fetching employee data:", error);
        setEmployee(null);
        return;
      }
      console.log("Fetch de data hecho con exito", data)
      setEmployee(data);
      await AsyncStorage.setItem("employee", JSON.stringify(data));
      
      return data;
    }
  };

  if (loading)
    return (
      <Spinner
        // color="#3B82F6" // azul Gluestack por defecto
        // size={50}       // tamaño del ActivityIndicator
      />
    );

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, employee: employee ?? null, loading, fetchEmployee, setEmployee }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;