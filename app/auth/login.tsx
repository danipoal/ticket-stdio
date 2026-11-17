import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "expo-router";
import { login } from "@/utils/supabase";
import { isValidEmail } from "@/utils/validation";
import { Toast, ToastDescription, ToastTitle, useToast } from "@gluestack-ui/themed";



const Login = () => {

  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

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

  const [validated, setValidated] = useState({
    emailValid: true,
    passwordValid: true,
  });
  const showLoginErrorToast = (message = "") => {
  toast.show({
    placement: "top",
    duration: 3000,
    render: ({ id }) => {
      return (
        <Toast nativeID={id} action="error" variant="solid">
          <ToastTitle>No se pudo iniciar sesión</ToastTitle>
          <ToastDescription>{message}</ToastDescription>
        </Toast>
      );
    },
  });
};


  const onSubmit = async (data: any) => {
    if (submitting) return;
    clearErrors();
    let valid = true;

    if (!data.email) {
      setError("email", { type: "required", message: "El email es obligatorio" });
      valid = false;
    } else if (!isValidEmail(data.email)) {
      setError("email", { type: "pattern", message: "El email no es válido" });
      valid = false;
    }

    if (!data.password) {
      setError("password", {
        type: "required",
        message: "La contraseña es obligatoria",
      });
      valid = false;
    }

    if (!valid) return;

    setValidated({ emailValid: true, passwordValid: true });

    setSubmitting(true);
    try {
      const result = await login(data.email, data.password);
      if (!result.ok) {
        showLoginErrorToast(result.message);
        return;
      }
      // La navegación la hace el guardia de rutas de AuthProvider cuando la
      // sesión y el empleado están cargados.
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  function redirectSignIn() {
    router.push("/auth/signin");
  }

  const [showPassword, setShowPassword] = useState(false);


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inicio sesión</Text>

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
              testID="login-email"
              placeholder="Introduce Email"
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
        {!validated.emailValid && (
          <Text style={styles.errorText}>Email ID not found</Text>
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
                testID="login-password"
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
        {!validated.passwordValid && (
          <Text style={styles.errorText}>Password was incorrect</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, submitting ? { opacity: 0.6 } : undefined]}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
        activeOpacity={0.8}
        testID="login-submit"
      >
        <Text style={styles.buttonText}>{submitting ? "Entrando..." : "Entrar"}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={redirectSignIn}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Registrate</Text>
      </TouchableOpacity>
    </View>

  );
};

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  title: {
    fontSize: 32,
    marginBottom: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  formControl: { marginBottom: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 5,
  },
  inputError: {
    borderColor: "red",
  },
  errorText: {
    color: "red",
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
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    borderRadius: 5,
    marginTop: 15,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});

export default Login;