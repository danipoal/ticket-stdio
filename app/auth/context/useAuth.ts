import { useContext } from "react";
import { AuthContext } from "./AuthContext";


const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};

export default useAuth;

// Hay que hacer que en el login se setee el employee justo despues de recibir el user