import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { Mail, Shield, Building2, IdCard, LogOut, MapPin, Hash } from "lucide-react-native"
import useAuth from "@/context/useAuth"
import { supabase } from "@/utils/supabase"
import Page from "@/components/custom/Page"
import { Avatar, Card, CardTitle, PrimaryButton } from "@/components/custom/ui"
import { palette } from "@/constants/theme"
import { initials } from "@/utils/dashboard"
import { useBreakpoint } from "@/hooks/useBreakpoint"

function Row({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <View style={s.row}>
      <View style={s.rowLabel}>
        {Icon ? <Icon size={16} color={palette.textMuted} /> : null}
        <Text style={s.label}>{label}</Text>
      </View>
      <Text style={s.value} numberOfLines={1}>{value || "-"}</Text>
    </View>
  )
}

export default function UserScreen() {
  const { employee, user, loading } = useAuth()
  const { isDesktop } = useBreakpoint()
  const [org, setOrg] = useState<any | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const orgId = employee?.id_organization
      if (!orgId) {
        setOrg(null)
        return
      }
      const { data: orgData } = await supabase.from("Organization").select("*").eq("id", orgId).maybeSingle()
      if (active) setOrg(orgData || null)
    }
    load()
    return () => {
      active = false
    }
  }, [employee?.id, employee?.id_organization])

  if (loading || !employee) {
    return (
      <Page title="Usuario">
        <Text style={s.value}>Cargando...</Text>
      </Page>
    )
  }

  const logOut = async () => {
    await supabase.auth.signOut()
    router.replace("/auth/login")
  }

  return (
    <Page title="Usuario" subtitle="Tu perfil y tu organización" maxWidth={980}>
      <View style={[s.cols, !isDesktop && { flexDirection: "column" }]}>
        <Card style={{ flex: 1 }} testID="card-employee">
          <View style={s.hero}>
            <Avatar text={initials(employee.name)} size={64} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.name}>{employee.name}</Text>
              <Text style={s.mail}>{user?.email}</Text>
              <View style={[s.role, employee.is_admin ? s.roleAdmin : null]}>
                <Shield size={12} color={employee.is_admin ? palette.primary : palette.textMuted} />
                <Text style={[s.roleText, employee.is_admin ? { color: palette.primary } : null]}>
                  {employee.is_admin ? "Administrador" : "Empleado"}
                </Text>
              </View>
            </View>
          </View>
          <CardTitle title="Datos del empleado" />
          <Row label="Nombre" value={employee.name} icon={IdCard} />
          <Row label="Correo" value={user?.email} icon={Mail} />
          <Row label="Es administrador" value={employee.is_admin ? "Sí" : "No"} icon={Shield} />
        </Card>

        <Card style={{ flex: 1 }} testID="card-org">
          <CardTitle title="Organización" subtitle={org?.name || "Sin organización"} />
          <Row label="VAT" value={org?.VAT_number} icon={Hash} />
          <Row label="Calle" value={org?.street} icon={MapPin} />
          <Row label="Ciudad" value={org?.city} icon={Building2} />
          <Row label="País" value={org?.country} icon={Building2} />
        </Card>
      </View>

      {/* En escritorio el cierre de sesion esta en la barra lateral */}
      {!isDesktop && (
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <PrimaryButton label="Cerrar sesión" onPress={logOut} testID="logout" icon={<LogOut size={16} color="#fff" style={{ marginRight: 8 }} />} />
        </View>
      )}
    </Page>
  )
}

const s = StyleSheet.create({
  cols: { flexDirection: "row", gap: 16, marginBottom: 16 },
  hero: { flexDirection: "row", alignItems: "center", marginBottom: 22, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: palette.border },
  name: { fontSize: 20, fontWeight: "800", color: palette.text },
  mail: { fontSize: 13.5, color: palette.textMuted, marginTop: 2 },
  role: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, backgroundColor: "#f3f4f6", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  roleAdmin: { backgroundColor: palette.primarySoft },
  roleText: { fontSize: 12, fontWeight: "600", color: palette.textMuted },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#f1f2f6" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13.5, color: palette.textMuted },
  value: { fontSize: 14, fontWeight: "600", color: palette.text, marginLeft: 16, flexShrink: 1 },
})
