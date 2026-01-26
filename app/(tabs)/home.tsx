import { Box, Text, VStack, Heading, HStack, Center, Icon } from "@gluestack-ui/themed"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/utils/supabase"
import useAuth from "@/app/auth/context/useAuth"
import { FileText, CheckCircle2, Hourglass, XCircle, ListOrdered, Euro } from "lucide-react-native"
import { DashboardStats } from "@/constants/types"

export default function HomeScreen() {
  const { employee } = useAuth()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    const run = async () => {
      if (!employee?.id) {
        setLoading(false)
        setError("No hay usuario")
        return
      }

      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("expense_dashboard_stats")
        .select("*")
        .eq("id_user", employee.id)
        .maybeSingle()

      if (error) {
        setError("Error cargando dashboard")
        setStats(null)
      } else {
        setStats(data as any)
      }
      setLoading(false)
    }

    run()
  }, [employee?.id])

  const money = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }), [])

  const StatCard = ({
    title,
    value,
    color,
    icon,
  }: {
    title: string
    value: string | number
    color: string
    icon: any
  }) => (
    <Box flex={1} bg={color} p={6} borderRadius="$lg" borderWidth={1} borderColor="$coolGray200">
      <HStack alignItems="center" justifyContent="space-between">
        <VStack space="xs">
          <Text color="$white" fontSize="$sm" opacity={0.9}>{title}</Text>
          <Heading size="xl" color="$white">
            {value}
          </Heading>
        </VStack>
        <Icon as={icon} size="xl" color="$white" opacity={0.9} />
      </HStack>
    </Box>
  )

  return (
    <Box flex={1} bg="$backgroundLight50">
      <VStack flex={1} space="lg" px={4} py={4} maxWidth={1024} alignSelf="center" w="$full">
        <Heading size="xl" textAlign="center">Dashboard</Heading>

        {loading && (
          <Center flex={1}><Text>Cargando resumen...</Text></Center>
        )}

        {!loading && error && (
          <Center flex={1}><Text color="$red600">{error}</Text></Center>
        )}

        {!loading && !error && stats && (
          <VStack space="md">
            {/* Fila 1 */}
            <HStack space="md">
              <StatCard
                title="Hojas de gasto"
                value={stats.total_expense_sheets}
                color="$indigo500"
                icon={FileText}
              />
              <StatCard
                title="Líneas de gasto"
                value={stats.total_expense_lines}
                color="$cyan500"
                icon={ListOrdered}
              />
            </HStack>

            {/* Fila 2 */}
            <HStack space="md">
              <StatCard
                title="Aprobadas"
                value={stats.approved_sheets}
                color="$green500"
                icon={CheckCircle2}
              />
              <StatCard
                title="Pendientes"
                value={stats.pending_sheets}
                color="$yellow500"
                icon={Hourglass}
              />
            </HStack>

            {/* Fila 3 */}
            <HStack space="md">
              <StatCard
                title="Rechazadas"
                value={stats.denied_sheets}
                color="$red500"
                icon={XCircle}
              />
              <StatCard
                title="Importe total"
                value={money.format(Number(stats.total_amount || 0))}
                color="$purple500"
                icon={Euro}
              />
            </HStack>
          </VStack>
        )}
      </VStack>
    </Box>
  )
}
