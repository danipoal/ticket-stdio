import React, { useMemo, useState } from "react";
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
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectItem,
  Pressable,
  Text,
  Icon,
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@gluestack-ui/themed";
import { Calendar } from "react-native-calendars";
import { X, RotateCcw } from "lucide-react-native";
import { ExpenseSheetPlain } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";
import { todayIso } from "@/utils/format";
import { validateSheet } from "@/utils/validation";
import useAuth from "@/context/useAuth";
import useAux from "@/context/useAux";

type CreateSheetViewProps = {
  onClose?: () => void;
  /** Devuelve un mensaje de error si no se pudo crear (el formulario queda abierto) o null si fue bien. */
  onCreate?: (values: ExpenseSheetPlain) => Promise<string | null> | string | null | void;
};

// Definido a nivel de modulo: cuando estaba dentro de CreateSheetView era un
// componente nuevo en cada render, y el calendario se desmontaba (perdiendo su
// estado "abierto") cada vez que cambiaba cualquier campo del formulario.
function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value || todayIso();

  return (
    <FormControl>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>

      <HStack space="sm" alignItems="center">
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ flex: 1 }}>
          <Input pointerEvents="none">
            <InputField value={value ?? ""} placeholder="YYYY-MM-DD" editable={false} />
          </Input>
        </Pressable>
        <Pressable
          accessibilityLabel="Limpiar fecha"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onChange(null)}
        >
          <Icon as={RotateCcw} size="lg" color="$coolGray700" />
        </Pressable>
      </HStack>

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Heading size="md">Selecciona fecha</Heading>
            <ModalCloseButton>
              <Icon as={X} />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody>
            <Calendar
              current={current}
              onDayPress={(day: { dateString: string | null }) => {
                onChange(day.dateString);
                setOpen(false);
              }}
              markedDates={value ? { [value]: { selected: true } } : undefined}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" action="secondary" onPress={() => setOpen(false)}>
              <ButtonText>Cerrar</ButtonText>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </FormControl>
  );
}

export default function CreateSheetView({ onClose, onCreate }: CreateSheetViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [approvalDate, setApprovalDate] = useState<string | null>("");
  const { sheetStatuses } = useAux();
  // Una hoja nueva SIEMPRE nace pendiente, salvo que quien la crea sea admin y
  // elija otro estado. Antes cualquier empleado podia crearla ya "Aprobada", y
  // si no habia estado "pend" se usaba sheetStatuses[0], que por el orden
  // alfabetico es "Aprobado".
  const [statusId, setStatusId] = useState<string>(String(SheetStatusID.PENDIENTE));
  const { employee } = useAuth();
  const isAdmin = !!employee?.is_admin;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const currentStatusLabel = useMemo(
    () => sheetStatuses.find((s) => String(s.id) === String(statusId))?.name ?? "",
    [statusId, sheetStatuses]
  );

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitError(null);
    const validation = validateSheet({
      title,
      description,
      project,
      approvalDate,
      idUser: employee?.id,
      idStatus: isAdmin ? statusId : String(SheetStatusID.PENDIENTE),
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


          <DatePickerField label="Fecha de aprobación" value={approvalDate} onChange={setApprovalDate} />

          {isAdmin && (
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Estado</FormControlLabelText>
            </FormControlLabel>
            {sheetStatuses && sheetStatuses.length > 0 ? (
              <Select selectedValue={statusId} onValueChange={(v: string) => setStatusId(v)}>
                <SelectTrigger>
                  <SelectInput value={currentStatusLabel} placeholder="Selecciona estado" />
                  <SelectIcon mr="$3" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    {sheetStatuses.map((s) => (
                      <SelectItem key={String(s.id)} label={s.name} value={String(s.id)} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            ) : (
              <Input>
                <InputField value={String(statusId)} onChangeText={(t) => setStatusId(t)} placeholder="ID de estado" />
              </Input>
            )}
          </FormControl>
          )}

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