import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
} from "react-native";
import { Text } from "@gluestack-ui/themed";

import { useForm, Controller } from "react-hook-form";
import { useRouter } from "expo-router";
import { signin } from "@/utils/supabase";
import { isValidEmail, MIN_PASSWORD_LENGTH } from "@/utils/validation";



// Register
const Signin = () => {

  const router = useRouter();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm({
    defaultValues: { email: "", password: "", rememberme: false },
  });

  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const redirectLogIn = () => {
    router.push("/auth/login");
  }

  const onSubmit = async (data: any) => {
    if (submitting) return;
    clearErrors();
    setFormMessage(null);
    let valid = true;

    if (!data.email) {
      setError("email", { type: "required", message: "El email es obligatorio" });
      valid = false;
    } else if (!isValidEmail(data.email)) {
      setError("email", { type: "pattern", message: "El email no es válido" });
      valid = false;
    }

    if (!data.password) {
      setError("password", { type: "required", message: "La contraseña es obligatoria" });
      valid = false;
    } else if (data.password.length < MIN_PASSWORD_LENGTH) {
      setError("password", {
        type: "minLength",
        message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      });
      valid = false;
    }

    if (!valid) return;

    setSubmitting(true);
    try {
      const result = await signin(data.email, data.password);
      if (!result.ok) {
        setFormMessage({ kind: "error", text: result.message });
        return;
      }
      if (result.needsConfirmation) {
        // Sin sesión todavía: hay que confirmar el email antes de poder entrar.
        setFormMessage({
          kind: "info",
          text: "Cuenta creada. Revisa tu correo y confirma el email; después inicia sesión.",
        });
        reset();
        return;
      }
      // Con sesión, el guardia de rutas lleva a completar el perfil.
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrate</Text>

      <View style={styles.formControl}>
        <Text>Email</Text>
        <Controller
          control={control}
          name="email"
          rules={{ required: "El email es obligatorio" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                errors.email ? styles.inputError : undefined,
              ]}
              testID="signin-email"
              placeholder="Introduce email"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={Keyboard.dismiss}
              returnKeyType="done"
            />
          )}
        />
        {errors.email && (
          <Text style={styles.errorText}>{errors.email.message}</Text>
        )}
      </View>

      <View style={styles.formControl}>
        <Text>Contraseña</Text>
        <Controller
          control={control}
          name="password"
          rules={{ required: "La contraseña es obligatoria" }}
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  errors.password ? styles.inputError : undefined,
                ]}
                testID="signin-password"
                placeholder="Introduce contraseña"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onSubmitEditing={handleSubmit(onSubmit)}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showPasswordBtn}
              >
                <Text>{showPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password.message}</Text>
        )}
      </View>

      {formMessage && (
        <Text
          testID="signin-message"
          style={formMessage.kind === "error" ? styles.errorText : styles.infoText}
        >
          {formMessage.text}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, submitting ? { opacity: 0.6 } : undefined]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
        activeOpacity={0.8}
        testID="signin-submit"
      >
        <Text style={styles.buttonText}>{submitting ? "Creando..." : "Crear cuenta"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={redirectLogIn}
        activeOpacity={0.8}
      >
        <Text style={[styles.buttonText, { color: "#4f46e5" }]}>Inicia sesión</Text>
      </TouchableOpacity>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: {
    fontSize: 30,
    marginBottom: 24,
    fontWeight: "800",
    textAlign: "center",
    color: "#111827",
    letterSpacing: -0.5,
  },
  formControl: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 6,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#dc2626",
  },
  errorText: {
    color: "#dc2626",
    marginTop: 5,
    fontSize: 13,
  },
  infoText: {
    color: "#166534",
    marginTop: 5,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  showPasswordBtn: {
    paddingHorizontal: 12,
  },
  button: {
    backgroundColor: "#4f46e5",
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 14,
  },
  buttonSecondary: {
    backgroundColor: "#eef0ff",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
});
export default Signin;
