import { Box, Text, VStack, Heading, Center, Avatar, HStack } from "@gluestack-ui/themed"
import useAuth from "../auth/context/useAuth"
import { Button, ButtonText } from "@/components/ui/button";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
import { useEffect } from "react";



export default function UserScreen() {
  const { employee, user, fetchEmployee, loading } = useAuth();

  useEffect(() => {
    if (!employee && user) {
      fetchEmployee();
    }
  }, [employee, user]);

  if (loading || !employee) {
    return <Text>Cargando...</Text>;
  }

  const logOut = () => {
    console.log("Log Out");
    AsyncStorage.removeItem("session");
    AsyncStorage.removeItem("employee");
    router.replace("/auth/login");
  }

  return (
    // <Box flex={1} bg="$backgroundLight50">
    //   <Center flex={1}>
    //     <VStack space="md" alignItems="center">
    //       <Heading size="xl">Usuario</Heading>
    //       <Text>Tu perfil de usuario</Text>
    //     </VStack>
    //   </Center>
    // </Box>
    <Box flex={1}>
      <VStack  alignItems="center">
        <Avatar

        />
        <Heading >Nombre de Usuario: {employee?.name}</Heading>
        <Text>{user?.email}</Text>

        <Box bg="$coolGray100" p={4} borderRadius={8}>
          <HStack justifyContent="space-between">
            <Text>Publicaciones</Text>
            <Text fontWeight="bold">24</Text>
          </HStack>
        </Box>

        <Box w="100%" bg="$coolGray100" p={4} borderRadius={8}>
          <HStack justifyContent="space-between">
            <Text>Seguidores</Text>
            <Text fontWeight="bold">1,024</Text>
          </HStack>
        </Box>

        <Box w="100%" bg="$coolGray100" p={4} borderRadius={8}>
          <HStack justifyContent="space-between">
            <Text>Siguiendo</Text>
            <Text fontWeight="bold">86</Text>
          </HStack>
        </Box>
      </VStack>
      <Button action="primary" variant="solid" size="md" onPress={() => logOut()}>
        <ButtonText>Log out</ButtonText>
      </Button>
    </Box>

  )
}
