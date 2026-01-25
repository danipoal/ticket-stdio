import { Box, Text, VStack, Heading, Center, Avatar, HStack, Icon, Divider } from "@gluestack-ui/themed"
import useAuth from "../auth/context/useAuth"
import { Button, ButtonText } from "@/components/ui/button";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
import { useEffect, useMemo, useState } from "react";
import { Mail, Shield, CalendarClock, Building2, IdCard, LogOut } from "lucide-react-native";



export default function UserScreen() {
  const { employee, user, fetchEmployee, loading } = useAuth();
  const [org, setOrg] = useState<any | null>(null);
  const [fetching, setFetching] = useState<boolean>(false);

  // No hacemos fetch de employee aquí; se toma de useAuth

  useEffect(() => {
    const load = async () => {
      if (!employee?.id) return;
      setFetching(true);
      // Cargar organización si existe
      const orgId = employee.id_organization;
      if (orgId) {
        const { data: orgData } = await supabase
          .from('Organization')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();
        setOrg(orgData || null);
      } else {
        setOrg(null);
      }
      setFetching(false);
    };
    load();
  }, [employee?.id, employee?.id_organization]);

  // Eliminado cálculo de iniciales al no usar avatar

  if (loading || !employee) {
    return (
      <Center flex={1}><Text>Cargando...</Text></Center>
    );
  }

  const logOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem("session");
    await AsyncStorage.removeItem("employee");
    router.replace("/auth/login");
  };

  const InfoRow = ({ label, value, icon }: { label: string; value?: any; icon?: any }) => (
    <HStack alignItems="center" justifyContent="space-between" py={2}>
      <HStack space="sm" alignItems="center">
        {icon ? <Icon as={icon} size="sm" color="$coolGray600" /> : null}
        <Text color="$coolGray600">{label}</Text>
      </HStack>
      <Text fontWeight="$bold">{value ?? '-'}</Text>
    </HStack>
  );

  return (
    <Box flex={1} bg="$backgroundLight50">
      <VStack flex={1} space="lg" px={4} py={4} maxWidth={720} alignSelf="center" w="$full">
        {/* Header con avatar desactivado */}
        {false && (
          <HStack alignItems="center" space="md">
            <Avatar bgColor="$indigo600">
              <Text color="$white" fontWeight="$bold">U</Text>
            </Avatar>
            <VStack>
              <Heading size="lg">{employee?.name}</Heading>
              <HStack space="sm" alignItems="center">
                <Icon as={Mail} size="sm" color="$coolGray600" />
                <Text color="$coolGray700">{user?.email}</Text>
              </HStack>
            </VStack>
          </HStack>
        )}

        {/* Centro vertical de las tarjetas de datos */}
        <Center flex={1}>
          <VStack space="lg" w="$full">
            {/* Datos del empleado */}
            <Box bg="$white" p={12} borderRadius="$lg" borderWidth={1} borderColor="$coolGray200">
              <Heading size="md" mb={4}>Datos del empleado</Heading>
              <Divider mb={2} />
              <InfoRow label="Nombre" value={employee?.name} icon={IdCard} />
              <InfoRow label="Correo" value={user?.email} icon={Mail} />
              <InfoRow label="Es administrador" value={employee?.is_admin ? 'Sí' : 'No'} icon={Shield} />
              {/* <InfoRow label="Creado" value={employee?.created_at ? new Date(employee.created_at).toLocaleDateString() : '-'} icon={CalendarClock} /> */}
              {/* <InfoRow label="ID Admin" value={employee?.id_admin} icon={IdCard} /> */}
              {/* <InfoRow label="ID Organización" value={employee?.id_organization} icon={Building2} /> */}
              {/* <InfoRow label="ID Usuario" value={employee?.id_user} icon={IdCard} /> */}
            </Box>

            {/* Organización */}
            <Box bg="$white" p={12} borderRadius="$lg" borderWidth={1} borderColor="$coolGray200">
              <HStack alignItems="center" justifyContent="space-between" mb={4}>
                <Heading size="md">Organización</Heading>
                <HStack space="sm" alignItems="center">
                  <Icon as={Building2} size="sm" color="$coolGray600" />
                  <Text color="$coolGray700">{org?.name || 'Sin organización'}</Text>
                </HStack>
              </HStack>
              <Divider mb={2} />
              <VStack>
                {/* <InfoRow label="Creado" value={org?.created_at ? new Date(org.created_at).toLocaleDateString() : '-'} /> */}
                <InfoRow label="VAT" value={org?.VAT_number} />
                <InfoRow label="Calle" value={org?.street} />
                <InfoRow label="Ciudad" value={org?.city} />
                <InfoRow label="País" value={org?.country} />
              </VStack>
            </Box>
          </VStack>
        </Center>

        {/* Logout centrado y rojo */}
        <Center>
          <Button action="negative" variant="solid" size="lg" onPress={logOut}>
            <HStack space="sm" alignItems="center">
              <Icon as={LogOut} color="$red" />
              <ButtonText>Cerrar sesión</ButtonText>
            </HStack>
          </Button>
        </Center>
      </VStack>
    </Box>
  )
}
