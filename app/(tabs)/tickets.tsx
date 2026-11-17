import { Box, Text, VStack, Heading, ScrollView, HStack } from "@gluestack-ui/themed";
import AddButton from "@/components/custom/AddButton";
import SheetCard from "@/components/custom/SheetCard";
import CreateSheetView from "@/components/custom/CreateSheetView";
import SheetView from "@/components/custom/SheetView";
import useAuth from "@/context/useAuth";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import { ExpenseSheet, ExpenseSheetPlain } from "@/constants/types";
import { confirmAction } from "@/utils/confirm";

export default function TicketsScreen() {
  const { employee } = useAuth();
  const [sheets, setSheets] = useState<ExpenseSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSheetView, setCreateSheetView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ExpenseSheet | null>(null);


  useEffect(() => {
    if (!employee?.id) {
      // Sin ficha de empleado no hay nada que cargar; antes se quedaba en
      // "Cargando tickets..." para siempre.
      setSheets([]);
      setLoading(false);
      return;
    }
    fetchExpenseSheets();
  }, [employee?.id]);

  const fetchExpenseSheets = async (): Promise<ExpenseSheet[]> => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("expense_sheet_with_total")
      .select("*")
      .eq("id_user", employee?.id)
      .order("create_date", { ascending: false });

    let list: ExpenseSheet[] = [];
    if (error) {
      setError("Error cargando tickets");
      setSheets([]);
    } else {
      list = (data ?? []) as ExpenseSheet[];
      setSheets(list);
      // Mantener la hoja abierta sincronizada (estado/total actualizados)
      setSelectedSheet((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null));
    }

    setLoading(false);
    return list;
  };

  const deleteSheet = async (sheet: ExpenseSheet) => {
    setActionError(null);
    // Borrar una hoja borra tambien sus lineas: pedimos confirmacion.
    const ok = await confirmAction(
      "Eliminar hoja",
      `¿Eliminar "${sheet.title}" y todas sus líneas? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from('Expense_sheet')
      .delete()
      .eq('id', sheet.id);

    if (error) {
      setActionError("No se pudo eliminar la hoja");
      return;
    }

    setSelectedSheet((prev) => (prev?.id === sheet.id ? null : prev));
    fetchExpenseSheets();
  };

  // Devuelve un mensaje de error (el formulario sigue abierto) o null si fue bien.
  const onCreateSheet = async (values: ExpenseSheetPlain): Promise<string | null> => {
    const { error } = await supabase
      .from('Expense_sheet')
      .insert(values)
      .select()
      .single();

    if (error) {
      return "No se pudo crear la hoja. Inténtalo de nuevo";
    }
    setCreateSheetView(false);
    fetchExpenseSheets();
    return null;
  };

  return (
  <Box flex={1} bg="$backgroundLight50">
    <Box flex={1} w="$full">
      <VStack flex={1} w="$full" px={4} space="md" alignItems="stretch">
        <HStack alignItems="center" justifyContent="space-between" my={2}>          
          <Heading flex={1} size="xl" textAlign="center">
            Mis Tickets
          </Heading>
          <AddButton onPress={() => { setSelectedSheet(null); setCreateSheetView(true); }} />

          {/* Placeholder para mantener el título centrado */}
          {/* <Box w={40} h={40} /> */}
        </HStack>
        {createSheetView && (
          <CreateSheetView
            onClose={() => setCreateSheetView(false)}
            onCreate={onCreateSheet}
          />
        )}

        {selectedSheet && !createSheetView && (
          <SheetView
            sheet={selectedSheet}
            onClose={() => setSelectedSheet(null)}
            onStatusChange={() => fetchExpenseSheets()}
          />
        )}

        {actionError && (
          <Text textAlign="center" color="$red600" testID="tickets-action-error">
            {actionError}
          </Text>
        )}

        {loading && (
          <Text textAlign="center">Cargando tickets...</Text>
        )}

        {!loading && error && (
          <Text textAlign="center" color="$red600">
            {error}
          </Text>
        )}

        {!loading && !error && !createSheetView && !selectedSheet && sheets.length === 0 && (
          <Text textAlign="center">
            No tienes tickets todavía
          </Text>
        )}

        {!loading && !error && !createSheetView && !selectedSheet && (
          <ScrollView
            flex={1}
            w="$full"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
            showsVerticalScrollIndicator
          >
            {sheets.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onPress={() => { 
                  setSelectedSheet(sheet);
                }}
                onDelete={() => deleteSheet(sheet)}
              />
            ))}
          </ScrollView>
        )}
      </VStack>
    </Box>
  </Box>
  );

}
