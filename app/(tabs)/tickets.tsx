import { Box, Text, VStack, Heading, Center, ScrollView } from "@gluestack-ui/themed";
import useAuth from "../auth/context/useAuth";
import { supabase } from "@/utils/supabase";
import { useEffect, useState } from "react";


export type ExpenseSheet = {
  id: number;
  title: string;
  description: string;
  project: string;
  total_amount: string;
  create_date: string;
  approval_date: string;
  id_user: string;
  id_status: string;
};

export default function TicketsScreen() {
  const { employee } = useAuth();
  const [sheets, setSheets] = useState<ExpenseSheet[]>([]);
  const [loading, setLoading] = useState(true);
  // const [loadedSheets, setLoadedSheets] = useState(false);
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
        .from("Expense_sheet")
        .select("*")
        .eq("id_user", employee.id);

      if (error) {
        setError("Error cargando tickets");
        setSheets([]);
      } else {
        setSheets(data ?? []);
      }

      setLoading(false);
      // setLoadedSheets(true);
    };

    fetchExpenseSheets();
  }, [employee?.id]);

  return (
  <Box flex={1} bg="$backgroundLight50">
    <Center flex={1}>
      <VStack w="100%" px={4} space="md" alignItems="stretch">
        <Heading size="xl" textAlign="center">
          Mis Tickets
        </Heading>

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

        {!loading &&
          !error &&
          sheets.map((sheet) => (
            <Box
              key={sheet.id}
              w="100%"
              maxWidth="90%"
              alignSelf="center"
              bg="$white"
              p={4}
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$coolGray200"
            >
              <VStack space="sm">
                <Heading size="sm">{sheet.title}</Heading>

                {sheet.description && (
                  <Text color="$coolGray600">
                    {sheet.description}
                  </Text>
                )}

                <Text>
                  Proyecto:{" "}
                  <Text fontWeight="$bold">
                    {sheet.project}
                  </Text>
                </Text>

                <Text>
                  Total:{" "}
                  <Text fontWeight="$bold">
                    {sheet.total_amount} €
                  </Text>
                </Text>

                <Text fontSize="$sm" color="$coolGray500">
                  Creado:{" "}
                  {new Date(sheet.create_date).toLocaleDateString()}
                </Text>
              </VStack>
            </Box>
          ))}
      </VStack>
    </Center>
  </Box>
  );

}
