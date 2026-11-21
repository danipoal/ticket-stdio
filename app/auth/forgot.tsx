import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { requestPasswordReset } from "@/utils/supabase";
import { isValidEmail } from "@/utils/validation";

// Recuperar contraseña: pide el correo y envia el enlace. Siempre se responde lo mismo exista o no la cuenta
// (para no permitir averiguar que correos estan registrados).
export default function Forgot() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm({ defaultValues: { email: "" } });

  const onSubmit = async (data: { email: string }) => {
    if (submitting) return;
    setMessage(null);
    if (!isValidEmail(data.email)) {
      setMessage({ kind: "error", text: "El email no es válido" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(data.email);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.message });
        return;
      }
      setMessage({
        kind: "info",
        text: "Si existe una cuenta con ese correo, te hemos enviado un enlace para crear una nueva contraseña. Revisa también la carpeta de spam.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
      <Text style={styles.lead}>Escribe tu correo y te enviaremos un enlace para crear una nueva.</Text>

      <View style={styles.formControl}>
        <Text>Email</Text>
        <Controller
          control={control}
          name="email"
          rules={{ required: "El email es obligatorio" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              testID="forgot-email"
              style={[styles.input, errors.email ? styles.inputError : undefined]}
              placeholder="Introduce tu email"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={handleSubmit(onSubmit)}
              returnKeyType="send"
            />
          )}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
      </View>

      {message && (
        <Text testID="forgot-message" style={message.kind === "error" ? styles.errorText : styles.infoText}>
          {message.text}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, submitting ? { opacity: 0.6 } : undefined]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
        activeOpacity={0.8}
        testID="forgot-submit"
      >
        <Text style={styles.buttonText}>{submitting ? "Enviando..." : "Enviar enlace"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => router.push("/auth/login")}
        activeOpacity={0.8}
        testID="forgot-back"
      >
        <Text style={[styles.buttonText, { color: "#4f46e5" }]}>Volver a iniciar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: { fontSize: 28, marginBottom: 8, fontWeight: "800", textAlign: "center", color: "#111827", letterSpacing: -0.5 },
  lead: { textAlign: "center", color: "#6b7280", marginBottom: 22 },
  formControl: { marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginTop: 6, fontSize: 15, backgroundColor: "#fff" },
  inputError: { borderColor: "#dc2626" },
  errorText: { color: "#dc2626", marginTop: 5, fontSize: 13 },
  infoText: { color: "#166534", marginTop: 5 },
  button: { backgroundColor: "#4f46e5", paddingVertical: 13, borderRadius: 10, marginTop: 14 },
  buttonSecondary: { backgroundColor: "#eef0ff" },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 15 },
});
