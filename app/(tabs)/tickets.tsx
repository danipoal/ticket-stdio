import { Box, Text, VStack, Heading, ScrollView, HStack } from "@gluestack-ui/themed";
import AddButton from "@/components/custom/AddButton";
import SheetCard from "@/components/custom/SheetCard";
import CreateSheetView from "@/components/custom/CreateSheetView";
import SheetView from "@/components/custom/SheetView";
import useAuth from "@/context/useAuth";
import { supabase } from "@/utils/supabase";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text as RNText, TextInput, View } from "react-native";
import { Plus, Search, FileText } from "lucide-react-native";
import Page from "@/components/custom/Page";
import SheetListItem from "@/components/custom/SheetListItem";
import { Card, Chip, PrimaryButton } from "@/components/custom/ui";
import { palette } from "@/constants/theme";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { canDeleteSheet, filterSheets, statusCounts, StatusFilter } from "@/utils/sheets";
import { ExpenseSheet, ExpenseSheetPlain } from "@/constants/types";
import { confirmAction } from "@/utils/confirm";
import useBilling from "@/hooks/useBilling";
import QuotaBanner from "@/components/custom/QuotaBanner";
import { isLimitError, limitLevel, limitMessage } from "@/utils/billing";

export default function TicketsScreen() {
  const { employee } = useAuth();
  const [sheets, setSheets] = useState<ExpenseSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSheetView, setCreateSheetView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ExpenseSheet | null>(null);
  const { isDesktop, listWidth, detailWide } = useBreakpoint();
  // Cupo de tickets gratuitos de la empresa (sin estado = migracion de suscripciones sin aplicar: sin limite)
  const { status: billing, refresh: refreshBilling } = useBilling();
  const quotaBlocked = limitLevel(billing) === "blocked";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");


  useEffect(() => {
    if (!employee?.id) {
      // Sin ficha de empleado no hay nada que cargar; antes se quedaba en
      // "Cargando tickets..." para siempre.
      setSheets([]);
      setLoading(false);
      return;
    }
    fetchExpenseSheets();
  }, [employee?.id]);

  const fetchExpenseSheets = async (): Promise<ExpenseSheet[]> => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("expense_sheet_with_total")
      .select("*")
      .eq("id_user", employee?.id)
      .order("create_date", { ascending: false });

    let list: ExpenseSheet[] = [];
    if (error) {
      setError("Error cargando tickets");
      setSheets([]);
    } else {
      list = (data ?? []) as ExpenseSheet[];
      setSheets(list);
      // Mantener la hoja abierta sincronizada (estado/total actualizados)
      setSelectedSheet((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null));
    }

    setLoading(false);
    return list;
  };

  const deleteSheet = async (sheet: ExpenseSheet) => {
    setActionError(null);
    // Borrar una hoja borra tambien sus lineas: pedimos confirmacion.
    const ok = await confirmAction(
      "Eliminar hoja",
      `¿Eliminar "${sheet.title}" y todas sus líneas? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    // Los adjuntos van a un bucket privado y solo se pueden borrar mientras la hoja existe y esta pendiente:
    // se quitan ANTES de borrar la hoja (si falla se sigue: es una limpieza, no debe impedir el borrado).
    try {
      const { data: lineRows } = await supabase.from('Expense_line').select('foto_path').eq('id_sheet', sheet.id);
      const paths = ((lineRows ?? []) as { foto_path?: string | null }[]).map((l) => l.foto_path).filter((p): p is string => !!p);
      if (paths.length > 0) await supabase.storage.from('tickets').remove(paths);
    } catch {
      /* limpieza de adjuntos opcional */
    }

    // .select() devuelve las filas borradas: sin error pero con 0 filas significa que la base de datos
    // (RLS) no lo permite, p. ej. una hoja ya aprobada.
    const { data: deleted, error } = await supabase
      .from('Expense_sheet')
      .delete()
      .eq('id', sheet.id)
      .select('id');

    if (error) {
      setActionError("No se pudo eliminar la hoja");
      return;
    }
    if (!deleted || deleted.length === 0) {
      setActionError("No se puede eliminar esta hoja: ya no está pendiente");
      return;
    }

    setSelectedSheet((prev) => (prev?.id === sheet.id ? null : prev));
    fetchExpenseSheets();
  };

  // Devuelve un mensaje de error (el formulario sigue abierto) o null si fue bien.
  const onCreateSheet = async (values: ExpenseSheetPlain): Promise<string | null> => {
    const { data: created, error } = await supabase
      .from('Expense_sheet')
      .insert(values)
      .select()
      .single();

    if (error) {
      if (isLimitError(error)) {
        // Otro compañero pudo gastar el ultimo cupo mientras se rellenaba el formulario
        const fresh = await refreshBilling();
        return fresh ? limitMessage(fresh, !!employee?.is_admin) : "La empresa ha agotado sus tickets gratuitos. Avisa a la administración para que active la suscripción.";
      }
      return "No se pudo crear la hoja. Inténtalo de nuevo";
    }
    refreshBilling();
    setCreateSheetView(false);
    // Abrir la hoja recien creada para poder añadir lineas directamente
    const list = await fetchExpenseSheets();
    const createdId = (created as { id?: number } | null)?.id;
    const opened = createdId ? list.find((s) => s.id === createdId) : undefined;
    if (opened) setSelectedSheet(opened);
    return null;
  };

  const visible = useMemo(() => filterSheets(sheets, { query, status: statusFilter }), [sheets, query, statusFilter]);
  const counts = useMemo(() => statusCounts(sheets), [sheets]);

  const toolbar = sheets.length > 0 && (
    <View style={s.toolbar} testID="sheet-toolbar">
      <View style={s.search}>
        <Search size={16} color={palette.textMuted} />
        <TextInput
          testID="sheet-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por título o proyecto"
          placeholderTextColor={palette.textMuted}
          style={[s.searchInput, { outlineStyle: "none" } as any]}
        />
      </View>
      <View style={s.chips}>
        <Chip testID="filter-all" label="Todas" count={counts.all} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        <Chip testID="filter-1" label="Pendientes" count={counts[1]} active={statusFilter === 1} onPress={() => setStatusFilter(1)} />
        <Chip testID="filter-2" label="Aprobadas" count={counts[2]} active={statusFilter === 2} onPress={() => setStatusFilter(2)} />
        <Chip testID="filter-3" label="Rechazadas" count={counts[3]} active={statusFilter === 3} onPress={() => setStatusFilter(3)} />
      </View>
    </View>
  );

  const noMatches = !loading && !error && sheets.length > 0 && visible.length === 0;

  // El formulario de nueva hoja va en un scroll propio: en ventanas bajas el boton Crear quedaba fuera de pantalla
  const detailPane = createSheetView ? (
    <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled" testID="create-sheet-scroll">
      <CreateSheetView onClose={() => setCreateSheetView(false)} onCreate={onCreateSheet} />
    </ScrollView>
  ) : selectedSheet ? (
    <SheetView
      sheet={selectedSheet}
      wide={isDesktop && detailWide}
      onClose={() => setSelectedSheet(null)}
      onStatusChange={() => fetchExpenseSheets()}
      onLinesChange={() => fetchExpenseSheets()}
    />
  ) : (
    <Card style={s.placeholder} testID="detail-placeholder">
      <FileText size={34} color={palette.textMuted} />
      <RNText style={s.placeholderTitle}>Selecciona una hoja</RNText>
      <RNText style={s.placeholderText}>Elige una hoja de la lista para ver sus líneas, o crea una nueva.</RNText>
    </Card>
  );

  if (isDesktop) {
    return (
      <Page
        title="Mis tickets"
        subtitle={`${sheets.length} ${sheets.length === 1 ? "hoja" : "hojas"} de gasto`}
        maxWidth={1500}
        scroll={false}
        actions={
          <PrimaryButton
            testID="add-button"
            label="Nueva hoja"
            disabled={quotaBlocked}
            icon={<Plus size={16} color="#fff" style={{ marginRight: 6 }} />}
            onPress={() => { setSelectedSheet(null); setCreateSheetView(true); }}
          />
        }
      >
        <QuotaBanner status={billing} isAdmin={!!employee?.is_admin} />
        {toolbar}
        {actionError && <RNText style={s.error} testID="tickets-action-error">{actionError}</RNText>}
        <View style={s.panes}>
          <View style={[s.listPane, { width: listWidth }]}>
            {loading && <RNText style={s.state}>Cargando tickets...</RNText>}
            {!loading && error && <RNText style={[s.state, { color: palette.danger }]}>{error}</RNText>}
            {!loading && !error && sheets.length === 0 && <RNText style={s.state}>No tienes tickets todavía</RNText>}
            {noMatches && <RNText style={s.state}>Ninguna hoja coincide con la búsqueda</RNText>}
            {!loading && !error && (
              <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                {visible.map((sheet) => (
                  <SheetListItem
                    key={sheet.id}
                    sheet={sheet}
                    selected={selectedSheet?.id === sheet.id && !createSheetView}
                    onPress={() => { setCreateSheetView(false); setSelectedSheet(sheet); }}
                    onDelete={canDeleteSheet(sheet) ? deleteSheet : undefined}
                  />
                ))}
              </ScrollView>
            )}
          </View>
          <View style={s.detailPane}>{detailPane}</View>
        </View>
      </Page>
    );
  }

  return (
  <Box flex={1} bg="$backgroundLight50">
    <Box flex={1} w="$full">
      <VStack flex={1} w="$full" px={4} space="md" alignItems="stretch">
        <HStack alignItems="center" justifyContent="space-between" my={2}>          
          <Heading flex={1} size="xl" textAlign="center">
            Mis Tickets
          </Heading>
          <AddButton disabled={quotaBlocked} onPress={() => { setSelectedSheet(null); setCreateSheetView(true); }} />

          {/* Placeholder para mantener el título centrado */}
          {/* <Box w={40} h={40} /> */}
        </HStack>
        {!createSheetView && <QuotaBanner status={billing} isAdmin={!!employee?.is_admin} />}
        {createSheetView && (
          <CreateSheetView
            onClose={() => setCreateSheetView(false)}
            onCreate={onCreateSheet}
          />
        )}

        {selectedSheet && !createSheetView && (
          <SheetView
            sheet={selectedSheet}
            onClose={() => setSelectedSheet(null)}
            onStatusChange={() => fetchExpenseSheets()}
      onLinesChange={() => fetchExpenseSheets()}
          />
        )}

        {!createSheetView && !selectedSheet && toolbar}

        {actionError && (
          <Text textAlign="center" color="$red600" testID="tickets-action-error">
            {actionError}
          </Text>
        )}

        {loading && (
          <Text textAlign="center">Cargando tickets...</Text>
        )}

        {!loading && error && (
          <Text textAlign="center" color="$red600">
            {error}
          </Text>
        )}

        {!loading && !error && !createSheetView && !selectedSheet && sheets.length === 0 && (
          <Text textAlign="center">
            No tienes tickets todavía
          </Text>
        )}

        {!loading && !error && !createSheetView && !selectedSheet && (
          <ScrollView
            flex={1}
            w="$full"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
            showsVerticalScrollIndicator
          >
            {noMatches && (
              <Text textAlign="center">Ninguna hoja coincide con la búsqueda</Text>
            )}
            {visible.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onPress={() => { 
                  setSelectedSheet(sheet);
                }}
                onDelete={canDeleteSheet(sheet) ? () => deleteSheet(sheet) : undefined}
              />
            ))}
          </ScrollView>
        )}
      </VStack>
    </Box>
  </Box>
  );

}

const s = StyleSheet.create({
  toolbar: { marginBottom: 14, gap: 10 },
  search: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: palette.text },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  panes: { flex: 1, flexDirection: "row", gap: 20, minHeight: 0 },
  listPane: { width: 400 },
  detailPane: { flex: 1, minWidth: 0 },
  state: { fontSize: 14, color: palette.textMuted, marginVertical: 8 },
  error: { color: palette.danger, marginBottom: 10 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderTitle: { fontSize: 17, fontWeight: "700", color: palette.text, marginTop: 6 },
  placeholderText: { fontSize: 13.5, color: palette.textMuted, textAlign: "center", maxWidth: 320 },
});
