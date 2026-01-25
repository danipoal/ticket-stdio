import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
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
  Icon,
  ScrollView,
} from "@gluestack-ui/themed";
import { X, Plus, Trash2 } from "lucide-react-native";
import { supabase } from "@/utils/supabase";
import { ExpenseLinePlain, ExpenseSheet } from "@/constants/types";

type SheetViewProps = {
  sheet: ExpenseSheet;
  onClose?: () => void;
};

export default function SheetView({ sheet, onClose }: SheetViewProps) {
  const [lines, setLines] = useState<ExpenseLinePlain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState<string>("21");
  const [idPaymentType, setIdPaymentType] = useState<string>("");
  const [idCategory, setIdCategory] = useState<string>("");
  const [foto, setFoto] = useState<string>("");

  useEffect(() => {
    fetchExpenseLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  const fetchExpenseLines = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("Expense_line")
      .select("*")
      .eq("id_sheet", String(sheet.id));

    if (error) {
      setError("Error cargando líneas de gasto");
      setLines([]);
    } else {
      setLines((data ?? []) as ExpenseLinePlain[]);
    }

    setLoading(false);
  };

  const handleCreateLine = async () => {
    if (!title || !idPaymentType || !idCategory) {
      setError("Rellena título, tipo de pago y categoría");
      return;
    }

    const payload: ExpenseLinePlain = {
      title,
      amount: amount ? Number(amount) : undefined,
      date: date ?? null,
      tax: Number(tax || "0"),
      foto: foto || undefined,
      id_payment_type: idPaymentType,
      id_category: idCategory,
      id_sheet: String(sheet.id),
    };

    const { error } = await supabase
      .from("Expense_line")
      .insert(payload)
      .select();

    if (error) {
      setError("Error creando la línea de gasto");
      return;
    }

    // Reset form y refrescar lista
    setTitle("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setTax("21");
    setIdPaymentType("");
    setIdCategory("");
    setFoto("");
    setCreateOpen(false);
    fetchExpenseLines();
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  return (
    <Box flex={1} w="$full" alignItems="center" justifyContent="center">
      <Box
        position="relative"
        w="$full"
        flex={1}
        maxWidth={720}
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

        {/* Encabezado con datos de la hoja */}
        <VStack space="md">
          <Heading size="lg" textAlign="center">
            {sheet.title}
          </Heading>
          {sheet.description ? (
            <Text textAlign="center" color="$coolGray600">{sheet.description}</Text>
          ) : null}
          <HStack space="md" justifyContent="center">
            <Text>
              Proyecto: <Text fontWeight="$bold">{sheet.project}</Text>
            </Text>
            <Text>
              Estado: <Text fontWeight="$bold">{sheet.status?.name}</Text>
            </Text>
          </HStack>
          <HStack space="md" justifyContent="center">
            <Text>
              Total: <Text fontWeight="$bold">{sheet.total_amount} €</Text>
            </Text>
            <Text color="$coolGray600">
              Creado: {formatDate(sheet.create_date)}
            </Text>
          </HStack>
        </VStack>

        {/* Acciones */}
        <HStack mt={16} mb={8} alignItems="center" justifyContent="space-between">
          <Heading size="md">Líneas de gasto</Heading>
          <Button onPress={() => setCreateOpen((x) => !x)}>
            <Icon as={Plus} mr="$2" />
            <ButtonText>Añadir línea</ButtonText>
          </Button>
        </HStack>
        {/* Contenido desplazable: formulario + lista/estados */}
        <ScrollView
          flex={1}
          w="$full"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator
        >
          {/* Formulario de creación dentro del scroll */}
          {createOpen && (
            <VStack space="md" mb={16}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Título</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField value={title} onChangeText={setTitle} placeholder="Título del gasto" />
                </Input>
              </FormControl>

              <HStack space="md">
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Importe (€)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
                  </Input>
                </FormControl>
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>IVA (%)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={tax} onChangeText={setTax} keyboardType="numeric" placeholder="21" />
                  </Input>
                </FormControl>
              </HStack>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Fecha</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField value={date ?? ""} onChangeText={(t) => setDate(t || null)} placeholder="YYYY-MM-DD" />
                </Input>
              </FormControl>

              <HStack space="md">
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Tipo de pago (ID)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={idPaymentType} onChangeText={setIdPaymentType} placeholder="p.ej. 1" />
                  </Input>
                </FormControl>
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Categoría (ID)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={idCategory} onChangeText={setIdCategory} placeholder="p.ej. 1" />
                  </Input>
                </FormControl>
              </HStack>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Foto (URL opcional)</FormControlLabelText>
                </FormControlLabel>
                <Textarea>
                  <TextareaInput value={foto} onChangeText={setFoto} placeholder="https://..." />
                </Textarea>
              </FormControl>

              <HStack space="sm" justifyContent="flex-end">
                <Button variant="outline" action="secondary" onPress={() => setCreateOpen(false)}>
                  <ButtonText>Cancelar</ButtonText>
                </Button>
                <Button onPress={handleCreateLine}>
                  <ButtonText>Guardar línea</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}

          {/* Estados y lista */}
          {loading && <Text textAlign="center">Cargando líneas...</Text>}
          {!loading && error && (
            <Text textAlign="center" color="$red600">{error}</Text>
          )}
          {!loading && !error && lines.length === 0 && (
            <Text textAlign="center">No hay líneas todavía</Text>
          )}

          {!loading && !error && lines.length > 0 && (
            <>
              {lines.map((line) => (
                <Box
                  key={line.id}
                  w="$full"
                  bg="$coolGray100"
                  p={4}
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$coolGray200"
                  mb={8}
                >
                  <HStack alignItems="center" justifyContent="space-between" space="md">
                    <VStack space="sm" style={{ flex: 1 }}>
                      <Heading size="sm">{line.title}</Heading>
                      <HStack space="md">
                        <Text>
                          Importe: <Text fontWeight="$bold">{line.amount ?? 0} €</Text>
                        </Text>
                        <Text>
                          IVA: <Text fontWeight="$bold">{line.tax}%</Text>
                        </Text>
                      </HStack>
                      {line.date && (
                        <Text color="$coolGray600">Fecha: {formatDate(line.date)}</Text>
                      )}
                      {line.foto && (
                        <Text color="$coolGray600">Adjunto: {line.foto}</Text>
                      )}
                    </VStack>
                    <Pressable
                      onPress={async () => {
                        if (!line.id) return;
                        const { error } = await supabase
                          .from('Expense_line')
                          .delete()
                          .eq('id', line.id);
                        if (!error) {
                          fetchExpenseLines();
                        } else {
                          setError('Error eliminando la línea');
                        }
                      }}
                      accessibilityLabel="Eliminar línea"
                      accessibilityRole="button"
                      hitSlop={10}
                    >
                      <Icon as={Trash2} size="lg" color="$coolGray700" />
                    </Pressable>
                  </HStack>
                </Box>
              ))}
            </>
          )}
        </ScrollView>
      </Box>
    </Box>
  );
}
