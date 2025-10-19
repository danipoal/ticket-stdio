import { GluestackUIProvider } from "@gluestack-ui/themed"
import { config } from "@gluestack-ui/config"
import { Slot } from "expo-router"
import { StatusBar } from "expo-status-bar"
import AuthProvider from "./auth/context/AuthContext"
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View } from '@gluestack-ui/themed'

export default function RootLayout() {
  return (
  <AuthProvider>
    <GluestackUIProvider config={config}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <StatusBar style="auto" />
        <Slot />
      </SafeAreaProvider>
    </GluestackUIProvider>
  </AuthProvider>
  )
}
