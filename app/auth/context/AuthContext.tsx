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
  fetchEmployee: () => Promise<any>;
  setEmployee: (e: EmployeePlain | null) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeePlain | null>();
  
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
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

    const isInStorage = await initFromStorage();
    if (isInStorage) return;
    

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchEmployee();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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

      // Si ambos existen, no hace falta pedir nada más
      if (storedSession && storedEmployee) {
        setLoading(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error intendando leer los datos de session en Async")
      return false;
    }

  }

  const fetchEmployee = async () => {
    if (session?.user) {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id_user", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching employee data:", error);
        setEmployee(null);
        return;
      }
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