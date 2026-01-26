import { UIFormControl } from "@/components/ui/form-control";
import { View, Toast, useToast, ToastTitle, ToastDescription } from "@gluestack-ui/themed";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { supabase } from "@/utils/supabase";
import { Box } from "@/components/ui/box";
import useAuth from "../auth/context/useAuth"
import { useRouter } from "expo-router";
import { EmployeePlain, OrganizationPlain } from "@/constants/types";

const completeProfile = () => {
  const [code, setCode] = useState("");
  const [isValidated, setIsValidated] = useState(false);

  const { employee, user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationPlain | null>(null);
  const [employeeToCreate, setEmployeeToCreate] = useState<Partial<EmployeePlain>>({});
  const [isInvalid, setIsInvalid] = useState(false);
  const [name, setName] = useState("");
  const toast = useToast();
  const router = useRouter();


  const [isValidating, setIsValidating] = useState(false);
  const validateCode = async () => {
    try {
      const input = code?.trim();
      console.log("Validando código:", input);
      if (!input) {
        showErrorToast("Introduce un código de empresa");
        return;
      }
      setIsValidating(true);

      const { data: org, error } = await supabase
        .from('Organization')
        .select('*')
        .eq('VAT_number', input)
        .maybeSingle();

      console.log("Resultado Organization:", org, error);
      if (error) {
        showErrorToast(error.message);
        setOrganization(null);
        setIsValidated(false);
        return;
      }

      if (org) {
        setOrganization(org as OrganizationPlain);
        setIsValidated(true);
      } else {
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
    console.log(name);
    console.log(user);

    if(user && organization && name) {
      setEmployeeToCreate(prev => ({ // Por si lo necesito despues
        ...prev,
        name: name,
        id_organization: organization.id,
        id_user: user.id,
        is_admin: false,
      }));  
      const employee: Partial<EmployeePlain> = {
        name,
        id_organization: organization.id,
        id_user: user.id,
        is_admin: false,
      };
      const insertedEmployee = await submitEmployee(employee);
      if (insertedEmployee) 
        router.replace("/auth/login");
    } else {
      console.error("Falta algun dato")
    }
}

  const submitEmployee = async (employee: Partial<EmployeePlain>) => {
    
    const { data, error } = await supabase
      .from('employees')
      .insert([
        // { some_column: 'someValue', other_column: 'otherValue' },
        employee
      ])
      .select().single();
    
      if (error) {
        console.error(error.message);
        return null;
      }
      return data;
  }

  const showErrorToast = (message = "") => {
    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => {
        return (
          <Toast nativeID={id} action="error" variant="solid">
            <ToastTitle>Código incorrecto</ToastTitle>
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
                  value={code}
                  onChangeText={setCode}
                  placeholder="Código de empresa"
                />
              </Input>
              <Button onPress={validateCode} className="mt-3" isDisabled={isValidating}>
                <ButtonText>Validar código de empresa</ButtonText>
              </Button>
            </UIFormControl>
          ) : (
            <UIFormControl isRequired isInvalid={isInvalid} className="space-y-4">
              <Input>
                <InputField
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre"
                />
              </Input>

              <Button onPress={saveData}>
                <ButtonText>Guardar</ButtonText>
              </Button>
            </UIFormControl>
          )}
        </Box>
      </View>
    </View>

    )
}

export default completeProfile;