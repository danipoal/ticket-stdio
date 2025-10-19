import { UIFormControl } from "@/components/ui/form-control";
import { View } from "@gluestack-ui/themed";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { supabase } from "@/utils/supabase";
import { Select } from "@/components/ui/select";
import { Box } from "@/components/ui/box";

const completeProfile = () => {
  const [code, setCode] = useState("");
  const [isValidated, setIsValidated] = useState(false);


  const [Organization, setOrganization] = useState(null);
  const [isInvalid, setIsInvalid] = useState(false);
  const [name, setName] = useState("");
  


  const validateCode = async () => {
    console.log(code)

    let { data: org, error } = await supabase
    .from('Organization')
    .select("*")
    .eq('VAT_number', code)
    .maybeSingle();

    console.log(org);
    if (org) {
        setOrganization(org);
        setIsValidated(true);
    }
  }

  const saveData = async () => {
    console.log(name);
  }

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
            <Button onPress={validateCode} className="mt-3">
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