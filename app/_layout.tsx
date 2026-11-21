import { GluestackUIProvider } from "@gluestack-ui/themed"
import { config } from "@gluestack-ui/config"
import { Slot, usePathname } from "expo-router"
import Head from "expo-router/head"
import { StatusBar } from "expo-status-bar"
import AuthProvider from "@/context/AuthContext"
import AuxProvider from "@/context/AuxContext"
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useEffect } from "react"

function TitleSetter() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Ticket Stdio';
    }
  }, [pathname]);
  return null;
}

export default function RootLayout() {
  return (
  <>
  {/* Titulo por defecto tambien en el HTML estatico (antes de que cargue el JS la pestaña salia sin titulo). Va FUERA de
      AuthProvider: este no monta a sus hijos mientras carga y el Head no se llegaria a renderizar. */}
  <Head>
    <title>Ticket Stdio</title>
  </Head>
  <AuthProvider>
    <AuxProvider>
      <GluestackUIProvider config={config}>
        <SafeAreaProvider style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <TitleSetter />
          <Slot />
        </SafeAreaProvider>
      </GluestackUIProvider>
    </AuxProvider>
  </AuthProvider>
  </>
  )
}
