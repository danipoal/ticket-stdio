import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Users, Euro, Hourglass, FileText } from "lucide-react-native"
import { supabase } from "@/utils/supabase"
import useAuth from "@/context/useAuth"
import Page from "@/components/custom/Page"
import { Avatar, Card, CardTitle } from "@/components/custom/ui"
import { palette } from "@/constants/theme"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { initials } from "@/utils/dashboard"
import { formatAmount } from "@/utils/format"
import { DashboardStats } from "@/constants/types"

export default function SettingsScreen() {
  const { employee, loading: authLoading } = useAuth()
  const { isDesktop, isWide } = useBreakpoint()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<DashboardStats[]>([])
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const run = async () => {
      if (authLoading) return
      if (!employee || !employee.is_admin) {
        setRows([])
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("expense_dashboard_stats")
        .select("*")
        .eq("id_admin", employee.id)

      if (error) {
        setError("Error cargando estadísticas de administrados")
        setRows([])
      } else {
        const stats = (data ?? []) as DashboardStats[]
        setRows(stats)
        const ids = Array.from(new Set(stats.map((s) => s.id_user).filter(Boolean)))
        if (ids.length > 0) {
          const { data: emps, error: empErr } = await supabase
            .from("employees")
            .select("id_user,name")
            .in("id_user", ids)
          if (!empErr && emps) {
            const map: Record<string, string> = {}
            for (const e of emps as any[]) {
              if (e.id_user) map[e.id_user] = e.name ?? e.id_user
            }
            setUserNames(map)
          }
        }
      }
      setLoading(false)
    }

    run()
  }, [authLoading, employee?.id, employee?.is_admin])

  const totals = useMemo(
    () => ({
      people: rows.length,
      amount: rows.reduce((a, r) => a + Number(r.total_amount || 0), 0),
      pending: rows.reduce((a, r) => a + (r.pending_sheets || 0), 0),
      sheets: rows.reduce((a, r) => a + (r.total_expense_sheets || 0), 0),
    }),
    [rows]
  )
  const maxAmount = Math.max(...rows.map((r) => Number(r.total_amount || 0)), 1)

  // Vista restringida para no-admin
  if (!authLoading && (!employee || !employee.is_admin)) {
    return (
      <Page title="Equipo">
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={s.restrictedTitle}>Área restringida</Text>
          <Text style={s.muted}>Esta sección está disponible sólo para administradores.</Text>
        </Card>
      </Page>
    )
  }

  const Kpi = ({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: string }) => (
    <Card style={{ flexGrow: 1, flexBasis: isDesktop ? "23%" : "47%", minWidth: 150 }}>
      <View style={s.kpiTop}>
        <Text style={s.muted}>{title}</Text>
        <View style={[s.kpiIcon, { backgroundColor: tone + "1a" }]}><Icon size={17} color={tone} /></View>
      </View>
      <Text style={s.kpiValue}>{value}</Text>
    </Card>
  )

  return (
    <Page title="Equipo" subtitle="Resumen de los usuarios que administras">
      {loading && <Text style={s.muted}>Cargando estadísticas...</Text>}
      {!loading && error && <Text style={[s.muted, { color: palette.danger }]}>{error}</Text>}

      {!loading && !error && (
        <>
          <View style={s.kpis}>
            <Kpi title="Personas" value={String(totals.people)} icon={Users} tone="#4f46e5" />
            <Kpi title="Hojas de gasto" value={String(totals.sheets)} icon={FileText} tone="#0891b2" />
            <Kpi title="Pendientes" value={String(totals.pending)} icon={Hourglass} tone="#d97706" />
            <Kpi title="Importe total" value={`${formatAmount(totals.amount)} €`} icon={Euro} tone="#16a34a" />
          </View>

          <Card testID="team-table">
            <CardTitle title="Gasto por persona" />
            {isWide && (
              <View style={s.head}>
                <Text style={[s.th, { flex: 3 }]}>Usuario</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Hojas</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Líneas</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Aprob.</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Pend.</Text>
                <Text style={[s.th, s.right, { flex: 1 }]}>Rech.</Text>
                <Text style={[s.th, s.right, { flex: 2 }]}>Total</Text>
              </View>
            )}
            {rows.length === 0 ? (
              <Text style={s.muted}>No hay estadísticas para mostrar.</Text>
            ) : (
              rows.map((r) => {
                const name = userNames[r.id_user] ?? r.name
                const amount = Number(r.total_amount || 0)
                return (
                  <View key={r.id_user} style={s.tr}>
                    <View style={[s.person, { flex: 3 }]}>
                      <Avatar text={initials(name)} size={34} color="#6366f1" />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.name} numberOfLines={1}>{name}</Text>
                        <View style={s.track}><View style={[s.fill, { width: `${Math.max((amount / maxAmount) * 100, 2)}%` }]} /></View>
                      </View>
                    </View>
                    {isWide ? (
                      <>
                        <Text style={[s.td, s.right, { flex: 1 }]}>{r.total_expense_sheets}</Text>
                        <Text style={[s.td, s.right, { flex: 1 }]}>{r.total_expense_lines}</Text>
                        <Text style={[s.td, s.right, { flex: 1, color: palette.success }]}>{r.approved_sheets}</Text>
                        <Text style={[s.td, s.right, { flex: 1, color: palette.warning }]}>{r.pending_sheets}</Text>
                        <Text style={[s.td, s.right, { flex: 1, color: palette.danger }]}>{r.denied_sheets}</Text>
                      </>
                    ) : null}
                    <Text style={[s.td, s.right, s.bold, { flex: 2 }]}>{formatAmount(amount)} €</Text>
                  </View>
                )
              })
            )}
          </Card>
        </>
      )}
    </Page>
  )
}

const s = StyleSheet.create({
  muted: { fontSize: 13.5, color: palette.textMuted },
  restrictedTitle: { fontSize: 18, fontWeight: "700", color: palette.text, marginBottom: 6 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 16 },
  kpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kpiIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 8, letterSpacing: -0.4 },
  head: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: palette.border },
  th: { fontSize: 11.5, fontWeight: "700", color: palette.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  right: { textAlign: "right" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f2f6" },
  person: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 14, fontWeight: "600", color: palette.text, marginBottom: 5 },
  track: { height: 5, borderRadius: 3, backgroundColor: "#eef0f5", overflow: "hidden", maxWidth: 220 },
  fill: { height: 5, borderRadius: 3, backgroundColor: "#6366f1" },
  td: { fontSize: 14, color: palette.text },
  bold: { fontWeight: "800" },
})
