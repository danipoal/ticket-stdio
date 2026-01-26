import React, { useMemo, useState, useEffect } from "react";
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
import useAuth from "@/app/auth/context/useAuth";
import useAux from "@/app/auxdata/context/useAux";

type CreateSheetViewProps = {
  onClose?: () => void;
  onCreate?: (values: ExpenseSheetPlain) => void;
};

export default function CreateSheetView({ onClose, onCreate }: CreateSheetViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [createDate, setCreateDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [approvalDate, setApprovalDate] = useState<string | null>("");
  const { sheetStatuses } = useAux();
  const [statusId, setStatusId] = useState<string>("");
  const { employee } = useAuth();
  const currentStatusLabel = useMemo(
    () => sheetStatuses.find((s) => String(s.id) === String(statusId))?.name ?? "",
    [statusId, sheetStatuses]
  );

  useEffect(() => {
    if (!statusId && sheetStatuses && sheetStatuses.length > 0) {
      const pending = sheetStatuses.find((s) => s.name?.toLowerCase().includes("pend")) || sheetStatuses[0];
      setStatusId(String(pending.id));
    }
  }, [sheetStatuses]);

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const handleCreate = () => {
    const statusToSend = statusId || (sheetStatuses[0] ? String(sheetStatuses[0].id) : "");
    const payload: ExpenseSheetPlain = {
      title,
      description,
      project,
    //   create_date: createDate ?? "",
      approval_date: approvalDate ?? "",
      id_user: employee?.id ?? "",
      id_status: statusToSend,
    };
    onCreate?.(payload);
  };

  const DatePickerField = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string | null;
    onChange: (v: string | null) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const today = new Date();
    const current = value || formatDate(today);

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
                onDayPress={(day: { dateString: string | null; }) => {
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
              <InputField value={title} onChangeText={setTitle} placeholder="Introduce un título" />
            </Input>
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
              <InputField value={project} onChangeText={setProject} placeholder="Nombre del proyecto" />
            </Input>
          </FormControl>

          {/* <DatePickerField label="Fecha de creación" value={createDate} onChange={setCreateDate} /> */}

          <DatePickerField label="Fecha de aprobación" value={approvalDate} onChange={setApprovalDate} />

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

          <HStack space="sm" justifyContent="center">
            <Button onPress={handleCreate}>
              <ButtonText>Crear</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}