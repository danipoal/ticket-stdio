import React, { useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Input,
  InputField,
  Textarea,
  TextareaInput,
  Button,
  ButtonText,
  Pressable,
  Text,
  Icon,
} from "@gluestack-ui/themed";
import { X } from "lucide-react-native";
import { ExpenseSheetPlain } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";
import { validateSheet } from "@/utils/validation";
import useAuth from "@/context/useAuth";

type CreateSheetViewProps = {
  onClose?: () => void;
  /** Devuelve un mensaje de error si no se pudo crear (el formulario queda abierto) o null si fue bien. */
  onCreate?: (values: ExpenseSheetPlain) => Promise<string | null> | string | null | void;
};

export default function CreateSheetView({ onClose, onCreate }: CreateSheetViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const { employee } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitError(null);
    // Una hoja nueva nace SIEMPRE pendiente y sin fecha de aprobacion; la base de datos lo exige
    // (politica RLS) y la fecha de aprobacion la fija el sistema al aprobarla.
    const validation = validateSheet({
      title,
      description,
      project,
      approvalDate: null,
      idUser: employee?.id,
      idStatus: String(SheetStatusID.PENDIENTE),
    });
    if (!validation.ok) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const err = await onCreate?.(validation.payload);
      if (err) setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box w="$full" alignItems="center" justifyContent="center">
      <Box
        position="relative"
        w="$full"
        maxWidth={640}
        bg="$white"
        borderWidth={1}
        borderColor="$coolGray200"
        borderRadius="$lg"
        p={12}
      >
        <Pressable
          onPress={() => onClose?.()}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          position="absolute"
          right="$3"
          top="$3"
          zIndex={1}
          hitSlop={10}
        >
          <Icon as={X} size="lg" color="$coolGray700" />
        </Pressable>

        <VStack space="lg">
          <Heading size="lg" textAlign="center">
            Nueva hoja de gastos
          </Heading>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Título</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField testID="sheet-title" value={title} onChangeText={setTitle} placeholder="Introduce un título" />
            </Input>
            {errors.title ? <Text color="$red600" fontSize="$sm">{errors.title}</Text> : null}
          </FormControl>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Descripción</FormControlLabelText>
            </FormControlLabel>
            <Textarea>
              <TextareaInput value={description} onChangeText={setDescription} placeholder="Descripción opcional" />
            </Textarea>
          </FormControl>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Proyecto</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField testID="sheet-project" value={project} onChangeText={setProject} placeholder="Nombre del proyecto" />
            </Input>
            {errors.project ? <Text color="$red600" fontSize="$sm">{errors.project}</Text> : null}
          </FormControl>


          {submitError ? (
            <Text color="$red600" textAlign="center" testID="sheet-submit-error">{submitError}</Text>
          ) : null}

          <HStack space="sm" justifyContent="center">
            <Button testID="sheet-create" onPress={handleCreate} isDisabled={submitting}>
              <ButtonText>{submitting ? "Creando..." : "Crear"}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}