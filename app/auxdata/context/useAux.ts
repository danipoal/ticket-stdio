import { useContext } from "react";
import { AuxContext } from "./AuxContext";

const useAux = () => {
  const ctx = useContext(AuxContext);
  if (!ctx) throw new Error("useAux debe usarse dentro de AuxProvider");
  return ctx;
};

export default useAux;
