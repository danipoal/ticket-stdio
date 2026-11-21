import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { sessionFromLinkTokens, updatePassword } from "@/utils/supabase";
import { supabase } from "@/utils/supabase";
import { linkErrorMessage, parseAuthHash } from "@/utils/authLinks";
import { MIN_PASSWORD_LENGTH } from "@/utils/validation";

type Phase = "checking" | "ready" | "invalid" | "done";

// Nueva contraseña tras pulsar el enlace del correo. El enlace llega a /auth/reset#access_token=...&type=recovery:
// se abre la sesion temporal con esos tokens y se pide la contraseña nueva.
export default function Reset() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm({ defaultValues: { password: "", confirm: "" } });

  useEffect(() => {
    let active = true;
    (async () => {
      const hash = Platform.OS === "web" && typeof window !== "undefined" ? window.location.hash : "";
      const parsed = parseAuthHash(hash);
      const linkError = linkErrorMessage(parsed);
      if (linkError) {
        if (active) { setProblem(linkError); setPhase("invalid"); }
        return;
      }
      if (parsed.access_token && parsed.refresh_token) {
        const res = await sessionFromLinkTokens(parsed.access_token, parsed.refresh_token);
        if (!active) return;
        if (!res.ok) { setProblem("El enlace ha caducado o ya se ha usado. Pide uno nuevo."); setPhase("invalid"); return; }
        // Los tokens no deben quedarse en la barra de direcciones ni en el historial. Se limpia con el router
        // (expo-router restituye la URL con fragmento si se cambia con history.replaceState a mano). Al recargar la
        // pantalla ya no hay tokens, pero si hay sesion y se muestra el formulario.
        router.replace("/auth/reset");
        setPhase("ready");
        return;
      }
      // Sin tokens en la URL: valido solo si ya hay una sesion (p. ej. al recargar la pagina)
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) setPhase("ready");
      else { setProblem("Este enlace no es válido o ha caducado. Pide uno nuevo."); setPhase("invalid"); }
    })();
    return () => { active = false; };
  }, []);

  const onSubmit = async (data: { password: string; confirm: string }) => {
    if (submitting) return;
    setFormError(null);
    if (data.password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (data.password !== data.confirm) {
      setFormError("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const res = await updatePassword(data.password);
      if (!res.ok) { setFormError(res.message); return; }
      setPhase("done");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === "checking") {
    return <View style={styles.container}><Text style={styles.lead}>Comprobando el enlace...</Text></View>;
  }

  if (phase === "invalid") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enlace no válido</Text>
        <Text testID="reset-invalid" style={styles.errorText}>{problem}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/auth/forgot")} activeOpacity={0.8} testID="reset-request-new">
          <Text style={styles.buttonText}>Pedir un enlace nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Contraseña actualizada</Text>
        <Text testID="reset-done" style={styles.infoText}>Ya puedes usar tu nueva contraseña.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/(tabs)/home")} activeOpacity={0.8} testID="reset-continue">
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.lead}>Elige una contraseña nueva para tu cuenta.</Text>

      <View style={styles.formControl}>
        <Text>Contraseña</Text>
        <Controller
          control={control}
          name="password"
          rules={{ required: "La contraseña es obligatoria" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.passwordContainer}>
              <TextInput
                testID="reset-password"
                style={[styles.input, { flex: 1 }, errors.password ? styles.inputError : undefined]}
                placeholder="Nueva contraseña"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 12 }}>
                <Text>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
      </View>

      <View style={styles.formControl}>
        <Text>Repite la contraseña</Text>
        <Controller
          control={control}
          name="confirm"
          rules={{ required: "Repite la contraseña" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              testID="reset-confirm"
              style={[styles.input, errors.confirm ? styles.inputError : undefined]}
              placeholder="Repite la contraseña"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )}
        />
        {errors.confirm && <Text style={styles.errorText}>{errors.confirm.message}</Text>}
      </View>

      {formError && <Text testID="reset-error" style={styles.errorText}>{formError}</Text>}

      <TouchableOpacity
        style={[styles.button, submitting ? { opacity: 0.6 } : undefined]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
        activeOpacity={0.8}
        testID="reset-submit"
      >
        <Text style={styles.buttonText}>{submitting ? "Guardando..." : "Guardar contraseña"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: { fontSize: 28, marginBottom: 8, fontWeight: "800", textAlign: "center", color: "#111827", letterSpacing: -0.5 },
  lead: { textAlign: "center", color: "#6b7280", marginBottom: 22 },
  formControl: { marginBottom: 16 },
  passwordContainer: { flexDirection: "row", alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginTop: 6, fontSize: 15, backgroundColor: "#fff" },
  inputError: { borderColor: "#dc2626" },
  errorText: { color: "#dc2626", marginTop: 5, fontSize: 13, textAlign: "center" },
  infoText: { color: "#166534", marginTop: 5, textAlign: "center" },
  button: { backgroundColor: "#4f46e5", paddingVertical: 13, borderRadius: 10, marginTop: 14 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 15 },
});
