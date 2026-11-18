import { useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { ClipboardCheck, Search } from "lucide-react-native"
import { supabase } from "@/utils/supabase"
import useAuth from "@/context/useAuth"
import Page from "@/components/custom/Page"
import SheetListItem from "@/components/custom/SheetListItem"
import SheetView from "@/components/custom/SheetView"
import { Card, Chip } from "@/components/custom/ui"
import { palette } from "@/constants/theme"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { ExpenseSheet } from "@/constants/types"
import { filterSheets, statusCounts, StatusFilter } from "@/utils/sheets"

/**
 * Aprobaciones (administradores): hojas de las personas a las que aprueban.
 * Que hojas llegan aqui lo decide la base de datos (RLS): las propias y las de los empleados
 * que tienen a este administrador como responsable, o sin responsable de su organizacion.
 */
export default function ApprovalsScreen() {
  const { employee } = useAuth()
  const { isDesktop } = useBreakpoint()
  const [sheets, setSheets] = useState<ExpenseSheet[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExpenseSheet | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(1)

  const load = async () => {
    setLoading(true)
    setError(null)
    const [sheetRes, empRes] = await Promise.all([
      supabase.from("expense_sheet_with_total").select("*").order("create_date", { ascending: false }),
      supabase.from("employees").select("id,name"),
    ])
    if (sheetRes.error) {
      setError("Error cargando las hojas")
      setSheets([])
      setLoading(false)
      return
    }
    const list = (sheetRes.data ?? []) as ExpenseSheet[]
    setSheets(list)
    if (!empRes.error && empRes.data) {
      setNames(Object.fromEntries((empRes.data as any[]).map((e) => [e.id, e.name ?? "Sin nombre"])))
    }
    // mantener abierta la hoja seleccionada con sus datos actualizados
    setSelected((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null))
    setLoading(false)
  }

  useEffect(() => {
    if (!employee?.is_admin) {
      setLoading(false)
      return
    }
    load()
  }, [employee?.id, employee?.is_admin])

  const ownerName = (s: ExpenseSheet) => (s.id_user === employee?.id ? "Tú" : names[s.id_user] ?? "Sin nombre")

  const counts = useMemo(() => statusCounts(sheets), [sheets])
  const visible = useMemo(() => {
    // La busqueda tambien mira el nombre de la persona: se reutiliza el campo de texto libre del filtro
    const searchable = sheets.map((s) => ({ ...s, description: ownerName(s) }))
    const ids = new Set(filterSheets(searchable, { query, status: statusFilter }).map((s) => s.id))
    return sheets.filter((s) => ids.has(s.id))
  }, [sheets, query, statusFilter, names, employee?.id])

  if (!employee?.is_admin) {
    return (
      <Page title="Aprobaciones">
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={s.restrictedTitle}>Área restringida</Text>
          <Text style={s.muted}>Esta sección está disponible sólo para administradores.</Text>
        </Card>
      </Page>
    )
  }

  const toolbar = (
    <View style={s.toolbar}>
      <View style={s.search}>
        <Search size={16} color={palette.textMuted} />
        <TextInput
          testID="approvals-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por persona, título o proyecto"
          placeholderTextColor={palette.textMuted}
          style={[s.searchInput, { outlineStyle: "none" } as any]}
        />
      </View>
      <View style={s.chips}>
        <Chip testID="appr-filter-1" label="Pendientes" count={counts[1]} active={statusFilter === 1} onPress={() => setStatusFilter(1)} />
        <Chip testID="appr-filter-2" label="Aprobadas" count={counts[2]} active={statusFilter === 2} onPress={() => setStatusFilter(2)} />
        <Chip testID="appr-filter-3" label="Rechazadas" count={counts[3]} active={statusFilter === 3} onPress={() => setStatusFilter(3)} />
        <Chip testID="appr-filter-all" label="Todas" count={counts.all} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
      </View>
    </View>
  )

  const list = (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      {loading && <Text style={s.muted}>Cargando...</Text>}
      {!loading && error && <Text style={[s.muted, { color: palette.danger }]}>{error}</Text>}
      {!loading && !error && sheets.length === 0 && <Text style={s.muted}>No hay hojas que revisar.</Text>}
      {!loading && !error && sheets.length > 0 && visible.length === 0 && (
        <Text style={s.muted}>
          {statusFilter === 1 && !query ? "No tienes hojas pendientes de aprobar." : "Ninguna hoja coincide con el filtro."}
        </Text>
      )}
      {!loading &&
        visible.map((sheet) => (
          <SheetListItem
            key={sheet.id}
            sheet={sheet}
            ownerName={ownerName(sheet)}
            selected={selected?.id === sheet.id}
            onPress={() => setSelected(sheet)}
          />
        ))}
    </ScrollView>
  )

  const detail = selected ? (
    <SheetView sheet={selected} mode="approver" wide={isDesktop} onClose={() => setSelected(null)} onStatusChange={() => load()} />
  ) : (
    <Card style={s.placeholder} testID="approvals-placeholder">
      <ClipboardCheck size={34} color={palette.textMuted} />
      <Text style={s.placeholderTitle}>Selecciona una hoja</Text>
      <Text style={s.muted}>Revisa sus líneas y apruébala o recházala.</Text>
    </Card>
  )

  const subtitle = `${counts[1]} ${counts[1] === 1 ? "hoja pendiente" : "hojas pendientes"} de aprobar`

  if (isDesktop) {
    return (
      <Page title="Aprobaciones" subtitle={subtitle} maxWidth={1500} scroll={false}>
        {toolbar}
        <View style={s.panes}>
          <View style={s.listPane}>{list}</View>
          <View style={s.detailPane}>{detail}</View>
        </View>
      </Page>
    )
  }

  return (
    <Page title="Aprobaciones" subtitle={subtitle}>
      {selected ? (
        <View style={{ minHeight: 520 }}>{detail}</View>
      ) : (
        <>
          {toolbar}
          {list}
        </>
      )}
    </Page>
  )
}

const s = StyleSheet.create({
  muted: { fontSize: 13.5, color: palette.textMuted, marginVertical: 8 },
  restrictedTitle: { fontSize: 18, fontWeight: "700", color: palette.text, marginBottom: 6 },
  toolbar: { marginBottom: 14, gap: 10 },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: palette.text },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  panes: { flex: 1, flexDirection: "row", gap: 20, minHeight: 0 },
  listPane: { width: 400 },
  detailPane: { flex: 1, minWidth: 0 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderTitle: { fontSize: 17, fontWeight: "700", color: palette.text, marginTop: 6 },
})
