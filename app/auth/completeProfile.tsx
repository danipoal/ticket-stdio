import { UIFormControl } from "@/components/ui/form-control";
import { View, Toast, useToast, ToastTitle, ToastDescription } from "@gluestack-ui/themed";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { supabase } from "@/utils/supabase";
import { Box } from "@/components/ui/box";
import useAuth from "@/context/useAuth"
import { friendlyJoinError } from "@/utils/sheetHistory";

const CompleteProfile = () => {
  const [code, setCode] = useState("");
  const [isValidated, setIsValidated] = useState(false);

  const { user, fetchEmployee } = useAuth();
  const [organization, setOrganization] = useState<{ id: number | string; name: string } | null>(null);
  const isInvalid = false;
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const toast = useToast();


  const [isValidating, setIsValidating] = useState(false);
  const validateCode = async () => {
    try {
      const input = code?.trim();
      if (!input) {
        showErrorToast("Introduce un código de empresa");
        return;
      }
      setIsValidating(true);

      // El codigo de empresa ya no se busca leyendo la tabla Organization (era el NIF, publico): lo valida
      // una funcion de la base de datos que solo devuelve el nombre de la organizacion.
      const { data, error } = await supabase.rpc("organization_by_code", { p_code: input });

      if (error) {
        showErrorToast(friendlyJoinError(error.message));
        setOrganization(null);
        setIsValidated(false);
        return;
      }

      const org = Array.isArray(data) ? data[0] : data;
      if (org) {
        setOrganization(org as { id: number | string; name: string });
        setIsValidated(true);
      } else {
        setOrganization(null);
        showErrorToast("No se encontró organización para ese código");
      }
    } catch (e: any) {
      console.error("Error validando código:", e?.message ?? e);
      showErrorToast("Error inesperado validando el código");
    } finally {
      setIsValidating(false);
    }
  }

  const saveData = async () => {
    const cleanName = name.trim();
    if (!user || !organization) {
      showErrorToast("Falta validar el código de empresa", "No se pudo guardar");
      return;
    }
    if (!cleanName) {
      showErrorToast("Introduce tu nombre", "Falta el nombre");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      // Alta en una sola llamada: crea la ficha (nunca administrador) en la organizacion del codigo.
      const { error } = await supabase.rpc("join_organization", { p_code: code.trim(), p_name: cleanName });
      if (error) {
        showErrorToast(friendlyJoinError(error.message), "No se pudo guardar");
        return;
      }
      // Cargar el empleado en el contexto: el guardia de rutas te lleva a la home.
      await fetchEmployee(user.id);
    } finally {
      setSaving(false);
    }
  };

  const showErrorToast = (message = "", title = "Código incorrecto") => {
    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => {
        return (
          <Toast nativeID={id} action="error" variant="solid">
            <ToastTitle>{title}</ToastTitle>
            <ToastDescription>{message}</ToastDescription>
          </Toast>
        );
      },
    });
  };

    return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Box className="w-[90%] max-w-md bg-white p-6 rounded-2xl shadow-lg">
          <Text className="text-xl font-bold text-center mb-4">
            Configuración de nuevo Usuario
          </Text>

          {!isValidated ? (
            <UIFormControl isRequired isInvalid={isInvalid} className="mb-4">
              <Input>
                <InputField
                  testID="profile-code"
                  value={code}
                  onChangeText={setCode}
                  placeholder="Código de empresa"
                />
              </Input>
              <Button onPress={validateCode} className="mt-3" isDisabled={isValidating} testID="profile-validate">
                <ButtonText>Validar código de empresa</ButtonText>
              </Button>
            </UIFormControl>
          ) : (
            <UIFormControl isRequired isInvalid={isInvalid} className="space-y-4">
              <Text className="text-center mb-2" testID="profile-org">
                Te unirás a <Text className="font-bold">{organization?.name}</Text>
              </Text>
              <Input>
                <InputField
                  testID="profile-name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre"
                />
              </Input>

              <Button onPress={saveData} isDisabled={saving} testID="profile-save">
                <ButtonText>{saving ? "Guardando..." : "Guardar"}</ButtonText>
              </Button>
            </UIFormControl>
          )}
        </Box>
      </View>
    </View>

    )
}

export default CompleteProfile;