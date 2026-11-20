import { Tabs } from "expo-router"
import { Home, Ticket, Settings, User, ClipboardCheck, CreditCard } from "lucide-react-native"
import Sidebar from "@/components/custom/Sidebar"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import useAuth from "@/context/useAuth"

export default function TabLayout() {
  const { isDesktop } = useBreakpoint()
  const { employee } = useAuth()

  return (
    <Tabs
      // En escritorio: barra lateral propia en vez de la barra inferior de movil
      tabBar={isDesktop ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: isDesktop ? "left" : "bottom",
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
        },
        headerShown: !isDesktop,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Mis Tickets",
          tabBarIcon: ({ color }) => <Ticket size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Aprobaciones",
          // Solo quien aprueba hojas (administradores) ve esta pestaña
          href: employee?.is_admin ? undefined : null,
          tabBarIcon: ({ color }) => <ClipboardCheck size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Equipo",
          // Solo los administradores tienen contenido aqui: al resto se les oculta la pestaña
          href: employee?.is_admin ? undefined : null,
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: "Suscripción",
          // Pagar y gestionar la suscripcion es cosa de la administracion de la empresa
          href: employee?.is_admin ? undefined : null,
          tabBarIcon: ({ color }) => <CreditCard size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: "Usuario",
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}
