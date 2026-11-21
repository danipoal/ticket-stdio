import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View, Pressable } from "react-native"
import { useRouter } from "expo-router"
import { Euro, FileText, CheckCircle2, Hourglass, ListOrdered, TrendingUp, TrendingDown } from "lucide-react-native"
import { supabase } from "@/utils/supabase"
import useAuth from "@/context/useAuth"
import useAux from "@/context/useAux"
import Page from "@/components/custom/Page"
import { Card, CardTitle, StatusBadge, PrimaryButton } from "@/components/custom/ui"
import { BarChart, Donut, HBars } from "@/components/charts/charts"
import { palette } from "@/constants/theme"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { formatAmount, formatDateSafe, plural } from "@/utils/format"
import { LoadingState } from "@/components/custom/Loading"
import {
  LineRow, SheetRow, monthDelta, monthlySpend, recentSheets, sheetTotal,
  spendByCategory, spendByProject, summarize, breakdown,
} from "@/utils/dashboard"

type Sheet = SheetRow & { description?: string | null }

export default function HomeScreen() {
  const { employee } = useAuth()
  const { categories, paymentTypes } = useAux()
  const router = useRouter()
  const { isDesktop, isWide } = useBreakpoint()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [lines, setLines] = useState<LineRow[]>([])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!employee?.id) {
        setLoading(false)
        setError("No hay usuario")
        return
      }
      setLoading(true)
      setError(null)
      const { data: sheetData, error: sheetErr } = await supabase
        .from("expense_sheet_with_total")
        .select("*")
        .eq("id_user", employee.id)
      if (!active) return
      if (sheetErr) {
        setError("Error cargando dashboard")
        setLoading(false)
        return
      }
      const list = (sheetData ?? []) as Sheet[]
      setSheets(list)

      let lineList: LineRow[] = []
      if (list.length > 0) {
        const { data: lineData, error: lineErr } = await supabase
          .from("Expense_line")
          .select("*")
          .in("id_sheet", list.map((s) => String(s.id)))
        if (!active) return
        // Las lineas solo alimentan los graficos: si fallan se muestran vacios, no se rompe todo
        if (!lineErr) lineList = (lineData ?? []) as LineRow[]
      }
      setLines(lineList)
      setLoading(false)
    }
    run()
    return () => {
      active = false
    }
  }, [employee?.id])

  const summary = useMemo(() => summarize(sheets), [sheets])
  const months = useMemo(() => monthlySpend(lines, sheets), [lines, sheets])
  const delta = useMemo(() => monthDelta(months), [months])
  const catNames = useMemo(() => Object.fromEntries(categories.map((c) => [String(c.id), c.name])), [categories])
  const payNames = useMemo(() => Object.fromEntries(paymentTypes.map((c) => [String(c.id), c.name])), [paymentTypes])
  const byCategory = useMemo(() => spendByCategory(lines, catNames), [lines, catNames])
  const byPayment = useMemo(() => breakdown(lines, (l) => l.id_payment_type, payNames, 4), [lines, payNames])
  const byProject = useMemo(() => spendByProject(sheets), [sheets])
  const recent = useMemo(() => recentSheets(sheets, 6), [sheets])

  const firstName = (employee?.name ?? "").split(" ")[0]
  const monthLabel = new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })
  const kpiBasis = isDesktop ? "23%" : "47%"

  const Kpi = ({ title, value, sub, icon: Icon, tone, id }: { title: string; value: string; sub?: string; icon: any; tone: string; id: string }) => (
    <Card style={{ flexGrow: 1, flexBasis: kpiBasis, minWidth: isWide ? 200 : 150 }} testID={`kpi-${id}`}>
      <View style={s.kpiTop}>
        <Text style={s.kpiTitle}>{title}</Text>
        <View style={[s.kpiIcon, { backgroundColor: tone + "1a" }]}>
          <Icon size={18} color={tone} />
        </View>
      </View>
      <Text style={s.kpiValue} testID={`kpi-${id}-value`}>{value}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </Card>
  )

  if (loading) {
    return (
      <Page title="Inicio">
        <LoadingState label="Cargando resumen..." />
      </Page>
    )
  }
  if (error) {
    return (
      <Page title="Inicio">
        <Text style={[s.state, { color: palette.danger }]}>{error}</Text>
      </Page>
    )
  }

  if (sheets.length === 0) {
    return (
      <Page title={`Hola, ${firstName}`} subtitle="Aquí verás el resumen de tus gastos">
        <Card style={s.empty} testID="home-empty">
          <Text style={s.emptyTitle}>Todavía no tienes hojas de gasto</Text>
          <Text style={s.state}>Crea tu primera hoja para empezar a registrar gastos.</Text>
          <PrimaryButton label="Crear mi primera hoja" onPress={() => router.push("/tickets")} />
        </Card>
      </Page>
    )
  }

  const statusSlices = [
    { id: "ok", label: "Aprobadas", value: summary.approved, color: palette.success },
    { id: "pend", label: "Pendientes", value: summary.pending, color: "#f59e0b" },
    { id: "ko", label: "Rechazadas", value: summary.rejected, color: palette.danger },
  ]

  return (
    <Page title={`Hola, ${firstName}`} subtitle={`Resumen de tus gastos · ${monthLabel}`}>
      <View style={s.row}>
        <Kpi id="total" title="Importe total" value={`${formatAmount(summary.totalAmount)} €`} sub={`Media ${formatAmount(summary.averageSheet)} € por hoja`} icon={Euro} tone="#4f46e5" />
        <Kpi id="sheets" title="Hojas de gasto" value={String(summary.count)} sub={plural(lines.length, "línea registrada", "líneas registradas")} icon={FileText} tone="#0891b2" />
        <Kpi id="approved" title="Aprobado" value={`${formatAmount(summary.approvedAmount)} €`} sub={plural(summary.approved, "hoja", "hojas")} icon={CheckCircle2} tone={palette.success} />
        <Kpi id="pending" title="Pendiente de aprobar" value={`${formatAmount(summary.pendingAmount)} €`} sub={plural(summary.pending, "hoja", "hojas")} icon={Hourglass} tone="#d97706" />
      </View>

      <View style={s.row}>
        <Card style={{ flexGrow: 2, flexBasis: isDesktop ? "60%" : "100%" }} testID="card-monthly">
          <CardTitle
            title="Gasto mensual"
            subtitle="Últimos 8 meses"
            right={
              delta !== null ? (
                <View style={s.delta} testID="month-delta">
                  {delta >= 0 ? <TrendingUp size={14} color={palette.danger} /> : <TrendingDown size={14} color={palette.success} />}
                  <Text style={[s.deltaText, { color: delta >= 0 ? palette.danger : palette.success }]}>
                    {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}% vs mes anterior
                  </Text>
                </View>
              ) : null
            }
          />
          {months.every((m) => m.value === 0) ? (
            <Text style={s.state} testID="monthly-empty">Sin gasto en los últimos 8 meses</Text>
          ) : (
            <BarChart data={months} />
          )}
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: isDesktop ? "30%" : "100%" }} testID="card-status">
          <CardTitle title="Estado de las hojas" subtitle={`${summary.count} en total`} />
          <View style={s.donutRow}>
            <Donut slices={statusSlices} center={{ top: String(summary.count), bottom: summary.count === 1 ? "hoja" : "hojas" }} />
            <View style={{ flex: 1, marginLeft: 18 }}>
              {statusSlices.map((sl) => (
                <View key={sl.id} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: sl.color }]} />
                  <Text style={s.legendLabel}>{sl.label}</Text>
                  <Text style={s.legendValue}>{sl.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      </View>

      <View style={s.row}>
        <Card style={{ flexGrow: 1, flexBasis: isDesktop ? "30%" : "100%" }} testID="card-category">
          <CardTitle title="Gasto por categoría" />
          <HBars items={byCategory} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: isDesktop ? "30%" : "100%" }} testID="card-project">
          <CardTitle title="Gasto por proyecto" />
          <HBars items={byProject} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: isDesktop ? "30%" : "100%" }} testID="card-payment">
          <CardTitle title="Forma de pago" />
          <HBars items={byPayment} />
        </Card>
      </View>

      <Card testID="card-recent">
        <CardTitle
          title="Últimas hojas"
          right={
            <Pressable onPress={() => router.push("/tickets")} accessibilityRole="link" testID="see-all">
              <Text style={s.link}>Ver todas</Text>
            </Pressable>
          }
        />
        {recent.map((sh, i) => (
          <Pressable
            key={sh.id}
            onPress={() => router.push("/tickets")}
            style={({ hovered }: any) => [s.recentRow, i > 0 && s.recentBorder, hovered && { backgroundColor: "#fafbff" }]}
          >
            <View style={{ flex: 2 }}>
              <Text style={s.recentTitle} numberOfLines={1}>{sh.title}</Text>
              <Text style={s.recentSub} numberOfLines={1}>{sh.project || "Sin proyecto"}</Text>
            </View>
            {isWide ? <Text style={[s.recentCell, { flex: 1 }]}>{formatDateSafe(sh.create_date)}</Text> : null}
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <StatusBadge statusId={sh.status?.id} label={sh.status?.name} />
            </View>
            <Text style={[s.recentAmount, { flex: 1 }]}>{formatAmount(sheetTotal(sh))} €</Text>
          </Pressable>
        ))}
      </Card>
    </Page>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 16 },
  state: { fontSize: 14, color: palette.textMuted, marginVertical: 8 },
  empty: { alignItems: "flex-start", gap: 8, paddingVertical: 28 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: palette.text },
  kpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kpiTitle: { fontSize: 13, color: palette.textMuted, fontWeight: "600" },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 26, fontWeight: "800", color: palette.text, marginTop: 8, letterSpacing: -0.5 },
  kpiSub: { fontSize: 12.5, color: palette.textMuted, marginTop: 4 },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaText: { fontSize: 12.5, fontWeight: "600" },
  donutRow: { flexDirection: "row", alignItems: "center" },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 3, marginRight: 8 },
  legendLabel: { flex: 1, fontSize: 13.5, color: palette.text },
  legendValue: { fontSize: 14, fontWeight: "700", color: palette.text },
  link: { fontSize: 13.5, color: palette.primary, fontWeight: "600" },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4 },
  recentBorder: { borderTopWidth: 1, borderTopColor: palette.border },
  recentTitle: { fontSize: 14, fontWeight: "600", color: palette.text },
  recentSub: { fontSize: 12.5, color: palette.textMuted, marginTop: 1 },
  recentCell: { fontSize: 13.5, color: palette.textMuted },
  recentAmount: { fontSize: 14, fontWeight: "700", color: palette.text, textAlign: "right" },
})
