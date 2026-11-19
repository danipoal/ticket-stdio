import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { sessionFromLinkTokens } from "@/utils/supabase";
import { linkErrorMessage, parseAuthHash } from "@/utils/authLinks";

// Destino del enlace "Confirmar correo". Si Supabase trae la sesion en la URL se abre sola y el guardia de rutas
// lleva al alta del perfil; si no, se pide iniciar sesion.
export default function Confirmed() {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const hash = Platform.OS === "web" && typeof window !== "undefined" ? window.location.hash : "";
      const parsed = parseAuthHash(hash);
      const err = linkErrorMessage(parsed);
      if (err) { if (active) setProblem(err); return; }
      if (parsed.access_token && parsed.refresh_token) {
        await sessionFromLinkTokens(parsed.access_token, parsed.refresh_token);
        // Quitar los tokens de la URL con el router (no con history.replaceState: expo-router los restituye)
        if (active) router.replace("/auth/confirmed");
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{problem ? "No se pudo confirmar" : "Correo confirmado"}</Text>
      {problem ? (
        <Text testID="confirmed-problem" style={styles.errorText}>{problem}</Text>
      ) : (
        <Text testID="confirmed-ok" style={styles.lead}>Tu correo está confirmado. Ya puedes iniciar sesión.</Text>
      )}
      <TouchableOpacity style={styles.button} onPress={() => router.replace("/auth/login")} activeOpacity={0.8} testID="confirmed-login">
        <Text style={styles.buttonText}>Ir a iniciar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: { fontSize: 28, marginBottom: 8, fontWeight: "800", textAlign: "center", color: "#111827", letterSpacing: -0.5 },
  lead: { textAlign: "center", color: "#166534", marginBottom: 18 },
  errorText: { color: "#dc2626", textAlign: "center", marginBottom: 18 },
  button: { backgroundColor: "#4f46e5", paddingVertical: 13, borderRadius: 10, marginTop: 6 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 15 },
});
