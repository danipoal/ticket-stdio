import { GluestackUIProvider } from "@gluestack-ui/themed"
import { config } from "@gluestack-ui/config"
import { Slot, usePathname } from "expo-router"
import { StatusBar } from "expo-status-bar"
import AuthProvider from "./auth/context/AuthContext"
import AuxProvider from "./auxdata/context/AuxContext"
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from '@gluestack-ui/themed'
import { useEffect } from "react"

function TitleSetter() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Ticket-stdio';
    }
  }, [pathname]);
  return null;
}

export default function RootLayout() {
  return (
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
  )
}
