import { Box, Text, VStack, Heading, HStack, Center, Icon } from "@gluestack-ui/themed";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase";
import useAuth from "@/app/auth/context/useAuth";
import { FileText, ListOrdered, CheckCircle2, Hourglass, XCircle, Euro, UserRound } from "lucide-react-native";
import { DashboardStats } from "@/constants/types";


export default function SettingsScreen() {
  const { employee, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DashboardStats[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const money = useMemo(
    () => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }),
    []
  );

  useEffect(() => {
    const run = async () => {
      // Esperar a que Auth esté listo
      if (authLoading) return;

      // Si no hay employee o no es admin, no cargar datos
      if (!employee || !employee.is_admin) {
        setRows([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("expense_dashboard_stats")
        .select("*")
        .eq("id_admin", employee.id);

      if (error) {
        setError("Error cargando estadísticas de administrados");
        setRows([]);
      } else {
        const stats = (data ?? []) as DashboardStats[];
        setRows(stats);
        // Fetch nombres de usuarios para los id_user recolectados
        const ids = Array.from(new Set(stats.map((s) => s.id_user).filter(Boolean)));
        if (ids.length > 0) {
          const { data: emps, error: empErr } = await supabase
            .from("employees")
            .select("id_user,name")
            .in("id_user", ids);
          if (!empErr && emps) {
            const map: Record<string, string> = {};
            for (const e of emps as any[]) {
              if (e.id_user) map[e.id_user] = e.name ?? e.id_user;
            }
            setUserNames(map);
          }
        }
      }
      setLoading(false);
    };

    run();
  }, [authLoading, employee?.id, employee?.is_admin]);

  // Vista restringida para no-admin
  if (!authLoading && (!employee || !employee.is_admin)) {
    return (
      <Box flex={1} bg="$backgroundLight50">
        <Center flex={1}>
          <VStack space="md" alignItems="center">
            <Heading size="lg">Área restringida</Heading>
            <Text textAlign="center" color="$coolGray700">
              Esta sección está disponible sólo para administradores.
            </Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  // Tabla de estadísticas para administradores
  return (
    <Box flex={1} bg="$backgroundLight50">
      <VStack flex={1} space="lg" px={4} py={4} maxWidth={1024} alignSelf="center" w="$full">
        <Heading size="xl" textAlign="center">Resumen de usuarios administrados</Heading>

        {loading && (
          <Center flex={1}><Text>Cargando estadísticas...</Text></Center>
        )}

        {!loading && error && (
          <Center flex={1}><Text color="$red600">{error}</Text></Center>
        )}

        {!loading && !error && (
          <Box w="$full" bg="$white" borderWidth={1} borderColor="$coolGray200" borderRadius="$lg" overflow="hidden">
            {/* Cabecera de tabla con iconos */}
            <HStack bg="$coolGray100" p={4} borderBottomWidth={1} borderColor="$coolGray200" alignItems="center">
              <HStack flex={2} alignItems="center" space="xs">
                <Icon as={UserRound} size="sm" color="$coolGray700" />
                <Text fontWeight="$bold">Usuario</Text>
              </HStack>
              <HStack flex={1} justifyContent="flex-end">
                <Icon as={FileText} size="sm" color="$coolGray700" />
              </HStack>
              <HStack flex={1} justifyContent="flex-end">
                <Icon as={ListOrdered} size="sm" color="$coolGray700" />
              </HStack>
              <HStack flex={1} justifyContent="flex-end">
                <Icon as={CheckCircle2} size="sm" color="$coolGray700" />
              </HStack>
              <HStack flex={1} justifyContent="flex-end">
                <Icon as={Hourglass} size="sm" color="$coolGray700" />
              </HStack>
              <HStack flex={1} justifyContent="flex-end">
                <Icon as={XCircle} size="sm" color="$coolGray700" />
              </HStack>
              <HStack flex={2} justifyContent="flex-end" alignItems="center" space="xs">
                <Icon as={Euro} size="sm" color="$coolGray700" />
                <Text fontWeight="$bold">Total</Text>
              </HStack>
            </HStack>

            {/* Filas */}
            <VStack>
              {rows.length === 0 ? (
                <HStack p={4}>
                  <Text color="$coolGray700">No hay estadísticas para mostrar.</Text>
                </HStack>
              ) : (
                rows.map((r) => (
                  <HStack key={r.id_user} p={4} borderBottomWidth={1} borderColor="$coolGray100" alignItems="center">
                    <Text flex={2}>{userNames[r.name] ?? r.name}</Text>
                    <Text flex={1} textAlign="right">{r.total_expense_sheets}</Text>
                    <Text flex={1} textAlign="right">{r.total_expense_lines}</Text>
                    <Text flex={1} textAlign="right">{r.approved_sheets}</Text>
                    <Text flex={1} textAlign="right">{r.pending_sheets}</Text>
                    <Text flex={1} textAlign="right">{r.denied_sheets}</Text>
                    <Text flex={2} textAlign="right">{money.format(Number(r.total_amount || 0))}</Text>
                  </HStack>
                ))
              )}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
