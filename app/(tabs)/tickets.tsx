import { Box, Text, VStack, Heading, ScrollView, HStack } from "@gluestack-ui/themed";
import AddButton from "@/components/custom/AddButton";
import SheetCard from "@/components/custom/SheetCard";
import CreateSheetView from "@/components/custom/CreateSheetView";
import useAuth from "../auth/context/useAuth";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";
import { ExpenseSheet } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";

export default function TicketsScreen() {
  const { employee } = useAuth();
  const [sheets, setSheets] = useState<ExpenseSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSheetView, setCreateSheetView] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!employee?.id){
      console.error("No hay employee aun.")
      return;
    }

    const fetchExpenseSheets = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("expense_sheet_with_total")
        .select("*")
        .eq("id_user", employee.id);

      if (error) {
        setError("Error cargando tickets");
        setSheets([]);
      } else {
        setSheets(data ?? []);
        console.log(data);
      }

      setLoading(false);
    };

    fetchExpenseSheets();
  }, [employee?.id]);

  return (
  <Box flex={1} bg="$backgroundLight50">
    <Box flex={1} w="$full">
      <VStack flex={1} w="$full" px={4} space="md" alignItems="stretch">
        <HStack alignItems="center" justifyContent="space-between" my={2}>          
          <Heading flex={1} size="xl" textAlign="center">
            Mis Tickets
          </Heading>
          <AddButton onPress={() => setCreateSheetView(true)} />

          {/* Placeholder para mantener el título centrado */}
          {/* <Box w={40} h={40} /> */}
        </HStack>
        {createSheetView && (
          <CreateSheetView
            onClose={() => setCreateSheetView(false)}
            onCreate={(values) => {
              console.log("Crear hoja con:", values);
              setCreateSheetView(false);
            }}
          />
        )}

        {loading && (
          <Text textAlign="center">Cargando tickets...</Text>
        )}

        {!loading && error && (
          <Text textAlign="center" color="$red600">
            {error}
          </Text>
        )}

        {!loading && !error && sheets.length === 0 && (
          <Text textAlign="center">
            No tienes tickets todavía
          </Text>
        )}

        {!loading && !error && (
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
                  // TODO: Navegar a detalle del ticket
                  console.log("Abrir hoja", sheet.id);
                }}
              />
            ))}
          </ScrollView>
        )}
      </VStack>
    </Box>
  </Box>
  );

}
