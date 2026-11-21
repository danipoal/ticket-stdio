import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  HStack,
  Input,
  InputField,
  InputSlot,
  Button,
  ButtonText,
  Icon,
  ScrollView,
  Select,
  SelectTrigger,
  SelectInput,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectItem,
  SelectScrollView,
  SelectIcon,
} from "@gluestack-ui/themed";
import { Platform, Linking, Image, Pressable, StyleSheet, View as RNView, Text as RNText } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { X, Plus, Trash2, CheckCircle2, XCircle, Folder, CalendarDays, ListOrdered, Euro, CreditCard, Paperclip, ImagePlus, Receipt, History, RotateCcw } from "lucide-react-native";
import { supabase } from "@/utils/supabase";
import { ExpenseLinePlain, ExpenseSheet, SheetHistoryEntry } from "@/constants/types";
import useAux from "@/context/useAux";
import { SheetStatusID } from "@/constants/constants";
import { formatAmount, formatDateSafe, formatDateTimeSafe, todayIso } from "@/utils/format";
import { historyLabel } from "@/utils/sheetHistory";
import { validateLine } from "@/utils/validation";
import { checkPhoto, safeFileName } from "@/utils/files";
import { confirmAction } from "@/utils/confirm";
import { Banner, CategoryPill, EmptyState, IconButton, StatTile, StatusBadge } from "@/components/custom/ui";
import { palette, statusStyle } from "@/constants/theme";
import { LoadingState } from "@/components/custom/Loading";

type SheetViewProps = {
  sheet: ExpenseSheet;
  onClose?: () => void;
  /** Se llama tras cambiar el estado con exito, para que la lista se refresque. */
  onStatusChange?: (newStatusId: number) => void;
  /** Se llama tras añadir o borrar una linea, para que la lista de hojas refresque su total. */
  onLinesChange?: () => void;
  /** Escritorio: panel ancho con cabecera a la izquierda y lineas en tabla. */
  wide?: boolean;
  /**
   * owner: el empleado dueño de la hoja (añade/borra lineas mientras esta pendiente y la reenvia si la rechazan).
   * approver: quien la aprueba (solo lectura + aprobar/rechazar). Un empleado ya no aprueba sus propias hojas.
   */
  mode?: "owner" | "approver";
};

export default function SheetView({ sheet, onClose, onStatusChange, onLinesChange, wide = false, mode = "owner" }: SheetViewProps) {
  const isOwner = mode === "owner";
  const [lines, setLines] = useState<ExpenseLinePlain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // listError: fallo al cargar las lineas (sustituye a la lista).
  // actionError: fallo de una accion (borrar, subir foto...), se muestra como aviso
  // sin ocultar la lista. formErrors: errores de validacion por campo.
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string | null>(todayIso());
  const [tax, setTax] = useState<string>("21");
  const [idPaymentType, setIdPaymentType] = useState<string>("");
  const [idCategory, setIdCategory] = useState<string>("");
  const [foto, setFoto] = useState<string>("");
  const { paymentTypes, categories } = useAux();
  const [statusId, setStatusId] = useState<number>(sheet?.status?.id ?? SheetStatusID.PENDIENTE);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [reviewNote, setReviewNote] = useState<string>("");
  const [history, setHistory] = useState<SheetHistoryEntry[]>([]);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<any | null>(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  // El estado local debe seguir al de la hoja cuando el padre la refresca o
  // se abre otra hoja (antes se quedaba con el valor del primer render).
  useEffect(() => {
    setStatusId(sheet?.status?.id ?? SheetStatusID.PENDIENTE);
  }, [sheet?.id, sheet?.status?.id]);

  useEffect(() => {
    fetchExpenseLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  const fetchExpenseLines = async () => {
    setLoading(true);
    setListError(null);

    const { data, error } = await supabase
      .from("Expense_line")
      .select("*")
      .eq("id_sheet", String(sheet.id));

    if (error) {
      setListError("Error cargando líneas de gasto");
      setLines([]);
    } else {
      setLines((data ?? []) as ExpenseLinePlain[]);
    }

    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("Sheet_status_history")
      .select("*")
      .eq("id_sheet", sheet.id)
      // Por orden de registro (id): las hojas antiguas tienen fecha de aprobacion anterior a la de creacion
      .order("id", { ascending: true });
    // El historial es informativo: si falla (p. ej. aun no existe la tabla) la hoja se sigue usando
    setHistory(error ? [] : ((data ?? []) as SheetHistoryEntry[]));
  };

  useEffect(() => {
    fetchHistory();
    setReviewNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id, sheet?.status?.id]);

  const updateSheetStatus = async (newStatusId: number) => {
    try {
      setUpdatingStatus(true);
      setActionError(null);
      const { error } = await supabase
        .from("Expense_sheet")
        .update({
          id_status: String(newStatusId),
          // El motivo lo escribe quien revisa; al reenviar lo limpia la base de datos
          ...(!isOwner && reviewNote.trim() ? { review_note: reviewNote.trim() } : {}),
        })
        .eq("id", sheet.id);
      if (error) {
        setActionError("No se pudo actualizar el estado de la hoja");
        return;
      }
      setStatusId(newStatusId);
      setReviewNote("");
      fetchHistory();
      onStatusChange?.(newStatusId);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAttachPhoto = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const check = checkPhoto(file);
          if (!check.ok) {
            setActionError(check.message);
            return;
          }
          setActionError(null);
          setSelectedPhotoFile(file);
          setSelectedPhotoUri(URL.createObjectURL(file));
          setSelectedPhotoName(file.name);
        }
      };
      input.click();
    } else {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          setActionError("Permiso denegado para acceder a la galería");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setSelectedPhotoUri(asset.uri);
          setSelectedPhotoName(asset.fileName ?? "foto.jpg");
          setSelectedPhotoFile(null); // usaremos fetch->blob en móvil
        }
      } catch {
        setActionError("No se pudo abrir la galería");
      }
    }
  };

  const handleCreateLine = async () => {
    setActionError(null);
    const validation = validateLine({
      title,
      amount,
      tax,
      date,
      idPaymentType,
      idCategory,
      idSheet: sheet.id,
    });
    if (!validation.ok) {
      setFormErrors(validation.errors as Record<string, string>);
      return;
    }
    setFormErrors({});
    // Subir foto a Supabase Storage si hay seleccion. supabase-js NO lanza
    // excepcion cuando la subida falla: devuelve { error }. Antes se ignoraba y
    // se guardaba la URL publica de un fichero que no existia.
    let uploadedPath: string | undefined;
    if (selectedPhotoUri || selectedPhotoFile) {
      try {
        setUploadingPhoto(true);
        const filename = `${Date.now()}_${safeFileName(selectedPhotoName)}`;
        const path = `expense-lines/${sheet.id}/${filename}`;
        let body: any;
        let contentType = "image/jpeg";
        if (Platform.OS === "web" && selectedPhotoFile) {
          body = selectedPhotoFile;
          contentType = selectedPhotoFile.type || contentType;
        } else if (selectedPhotoUri) {
          const resp = await fetch(selectedPhotoUri);
          body = await resp.blob();
          contentType = body.type || contentType;
        }
        const { error: uploadError } = await supabase.storage
          .from("tickets")
          .upload(path, body, { contentType, upsert: false });
        if (uploadError) {
          setActionError("No se pudo subir la foto. La línea no se ha guardado");
          return;
        }
        // El bucket es privado: se guarda la RUTA y se abre con una URL firmada temporal
        uploadedPath = path;
      } catch {
        setActionError("No se pudo subir la foto. La línea no se ha guardado");
        return;
      } finally {
        setUploadingPhoto(false);
      }
    }

    const payload: ExpenseLinePlain = { ...validation.payload, foto: foto.trim() || undefined, foto_path: uploadedPath };

    const { error } = await supabase
      .from("Expense_line")
      .insert(payload)
      .select();

    if (error) {
      setActionError("Error creando la línea de gasto");
      return;
    }

    // Reset form y refrescar lista
    setTitle("");
    setAmount("");
    setDate(todayIso());
    setTax("21");
    setIdPaymentType("");
    setIdCategory("");
    setFoto("");
    // Sin esto la foto de esta linea se volvia a subir y adjuntar a la siguiente.
    setSelectedPhotoUri(null);
    setSelectedPhotoFile(null);
    setSelectedPhotoName(null);
    setFormErrors({});
    setCreateOpen(false);
    fetchExpenseLines();
    onLinesChange?.();
  };

  const formatDate = formatDateSafe;
  // El aviso de un campo desaparece en cuanto se corrige
  const clearFormError = (key: string) => setFormErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));

  // El total de la cabecera sigue a las lineas cargadas (antes se quedaba con el valor de la lista hasta recargar)
  const displayTotal = useMemo(() => {
    if (loading || listError) return sheet.total_amount;
    return Math.round(lines.reduce((a, l) => a + Number(l.amount ?? 0), 0) * 100) / 100;
  }, [lines, loading, listError, sheet.total_amount]);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [String(c.id), c.name])), [categories]);
  const paymentNames = useMemo(() => Object.fromEntries(paymentTypes.map((c) => [String(c.id), c.name])), [paymentTypes]);

  const deleteLine = async (line: ExpenseLinePlain) => {
    if (!line.id) return;
    const ok = await confirmAction("Eliminar línea", `¿Eliminar "${line.title}"?`);
    if (!ok) return;
    // El adjunto (bucket privado) solo se puede borrar mientras la hoja esta pendiente: antes que la fila
    if (line.foto_path) {
      try {
        await supabase.storage.from("tickets").remove([line.foto_path]);
      } catch {
        /* limpieza opcional: no impide borrar la linea */
      }
    }
    const { error } = await supabase.from("Expense_line").delete().eq("id", line.id);
    if (!error) {
      fetchExpenseLines();
      onLinesChange?.();
    } else {
      setActionError("Error eliminando la línea");
    }
  };

  // Abre el adjunto de una linea: ruta privada -> URL firmada (1 h); si no, la URL externa antigua
  const openAttachment = async (line: ExpenseLinePlain) => {
    let url: string | null | undefined = line.foto;
    if (line.foto_path) {
      const { data, error } = await supabase.storage.from("tickets").createSignedUrl(line.foto_path, 3600);
      if (error || !data?.signedUrl) {
        setActionError("No se pudo abrir el adjunto");
        return;
      }
      url = data.signedUrl;
    }
    await handleDownload(url);
  };

  const handleDownload = async (url?: string | null) => {
    if (!url) return;
    if (Platform.OS === 'web') {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        setActionError('No se pudo abrir el adjunto');
      }
      return;
    }

    // Android/iOS: descargar localmente y abrir/compartir
    try {
      const nameFromUrl = (() => {
        try {
          const clean = url.split('?')[0].split('#')[0];
          const last = clean.substring(clean.lastIndexOf('/') + 1) || 'adjunto.jpg';
          return last;
        } catch {
          return 'adjunto.jpg';
        }
      })();
      const baseDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const dest = baseDir + nameFromUrl;
      await FileSystem.downloadAsync(url, dest);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest);
        return;
      }

      Linking.openURL(dest).catch(() => setActionError('Archivo descargado, pero no se pudo abrir.'));
    } catch {
      setActionError('No se pudo descargar el adjunto');
    }
  };

  const canEditLines = isOwner && statusId === SheetStatusID.PENDIENTE;
  const st = statusStyle(statusId);
  const rejectedMsg = `Hoja rechazada. Reenvíala a aprobación para poder corregirla.${sheet.review_note ? ` Motivo: ${sheet.review_note}` : ""}`;

  const removePhoto = () => {
    setSelectedPhotoUri(null);
    setSelectedPhotoFile(null);
    setSelectedPhotoName(null);
  };

  const attachButton = (line: ExpenseLinePlain, label: string, withText = false) => (
    <Pressable
      testID={`open-attachment-${line.id}`}
      onPress={() => openAttachment(line)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ hovered, pressed }: any) => [styles.attachBtn, (hovered || pressed) && { backgroundColor: palette.primarySoft }]}
    >
      <Paperclip size={15} color={palette.primary} />
      {withText ? <RNText style={styles.attachText}>{Platform.OS === "web" ? "Abrir" : "Descargar"}</RNText> : null}
    </Pressable>
  );

  const deleteButton = (line: ExpenseLinePlain) => (
    <IconButton testID={`delete-line-${line.id}`} onPress={() => deleteLine(line)} label="Eliminar línea" danger>
      <Trash2 size={16} color={palette.textMuted} />
    </IconButton>
  );

  return (
    <Box flex={1} w="$full" alignItems="center" justifyContent={wide ? "flex-start" : "center"}>
      <RNView style={[styles.panel, { maxWidth: wide ? 99999 : 720, padding: wide ? 22 : 14 }]}>
        <RNView style={[styles.strip, { backgroundColor: st.fg }]} />
        <RNView style={styles.closeBtn}>
          <IconButton onPress={() => onClose?.()} label="Cerrar">
            <Icon as={X} size="lg" color="$coolGray700" />
          </IconButton>
        </RNView>

        {/* Toda la hoja se desplaza junta: cabecera, avisos, formulario, líneas e historial */}
        <ScrollView flex={1} w="$full" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator>
        {/* Cabecera */}
        <RNView testID={wide ? "sheet-header-wide" : "sheet-header"}>
          <RNView style={{ paddingRight: 40 }}>
          {sheet.reference ? (
            <RNText testID="sheet-reference" style={styles.reference}>{sheet.reference}</RNText>
          ) : null}
          <RNView style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
            <RNText style={[styles.title, { fontSize: wide ? 24 : 20 }]}>{sheet.title}</RNText>
            <StatusBadge statusId={statusId} label={sheet.status?.id === statusId ? sheet.status?.name : undefined} />
          </RNView>
          {sheet.description ? <RNText style={styles.description}>{sheet.description}</RNText> : null}
          </RNView>
          <RNView style={styles.stats}>
            <StatTile icon={<Folder size={15} color={palette.textMuted} />} label="Proyecto" value={sheet.project || "-"} />
            <StatTile icon={<CalendarDays size={15} color={palette.textMuted} />} label="Creada" value={formatDate(sheet.create_date)} />
            <StatTile icon={<ListOrdered size={15} color={palette.textMuted} />} label="Líneas" value={String(lines.length)} />
            <StatTile icon={<Euro size={15} color="#fff" />} label="Total" value={`${formatAmount(displayTotal)} €`} highlight testID="sheet-total" />
          </RNView>
        </RNView>

        <RNView style={{ gap: 10, marginTop: 14 }}>
          {isOwner && statusId === SheetStatusID.PENDIENTE && (
            <Banner tone="warning" testID="owner-hint-pending">Pendiente de aprobación por tu responsable. Puedes editarla hasta entonces.</Banner>
          )}
          {isOwner && statusId === SheetStatusID.RECHAZADO && (
            <Banner tone="danger" testID="owner-hint-rejected">{rejectedMsg}</Banner>
          )}
          {isOwner && statusId === SheetStatusID.APROBADO && (
            <Banner tone="success" testID="owner-hint-approved">Hoja aprobada: ya no se puede modificar.</Banner>
          )}
          {!isOwner && statusId === SheetStatusID.PENDIENTE && (
            <Input {...inputProps}>
              <InputField
                testID="review-note"
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="Motivo (opcional, lo verá el empleado)"
              />
            </Input>
          )}
        </RNView>

        {/* Acciones */}
        <RNView style={styles.sectionHead}>
          <RNView style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
            <RNText style={styles.sectionTitle}>Líneas de gasto</RNText>
            {!loading && !listError ? (
              <RNView style={styles.countChip}><RNText style={styles.countChipText}>{lines.length}</RNText></RNView>
            ) : null}
          </RNView>
          <HStack space="sm" alignItems="center">
            {!isOwner && statusId === SheetStatusID.PENDIENTE && (
              <>
                <Button testID="approve-sheet" action="positive" borderRadius="$lg" isDisabled={updatingStatus} onPress={() => updateSheetStatus(SheetStatusID.APROBADO)}>
                  <Icon as={CheckCircle2} color="$white" />
                  <ButtonText ml="$2">Aprobar</ButtonText>
                </Button>
                <Button testID="reject-sheet" action="negative" borderRadius="$lg" isDisabled={updatingStatus} onPress={() => updateSheetStatus(SheetStatusID.RECHAZADO)}>
                  <Icon as={XCircle} color="$white" />
                  <ButtonText ml="$2">Rechazar</ButtonText>
                </Button>
              </>
            )}
            {isOwner && statusId === SheetStatusID.RECHAZADO && (
              <Button testID="resubmit-sheet" bg="$indigo600" borderRadius="$lg" isDisabled={updatingStatus} onPress={() => updateSheetStatus(SheetStatusID.PENDIENTE)}>
                <Icon as={RotateCcw} color="$white" mr="$2" />
                <ButtonText>Reenviar a aprobación</ButtonText>
              </Button>
            )}
            {canEditLines && (
              <Button testID="add-line" bg="$indigo600" borderRadius="$lg" onPress={() => setCreateOpen((x) => !x)}>
                <Icon as={Plus} color="$white" mr="$2" />
                <ButtonText>Añadir línea</ButtonText>
              </Button>
            )}
          </HStack>
        </RNView>

          {/* Formulario de creación dentro del scroll */}
          {isOwner && createOpen && (
            <RNView style={styles.form}>
              <RNView style={styles.formHead}>
                <RNView style={styles.formIcon}><Plus size={16} color={palette.primary} /></RNView>
                <RNView style={{ flex: 1 }}>
                  <RNText style={styles.formTitle}>Nueva línea de gasto</RNText>
                  <RNText style={styles.formSub}>Rellena los datos del ticket y, si quieres, adjunta la foto.</RNText>
                </RNView>
              </RNView>

              <RNView style={styles.row}>
                <Field label="Título" name="title" error={formErrors.title} basis={320}>
                  <Input {...inputProps}>
                    <InputField testID="line-title" value={title} onChangeText={(v) => { setTitle(v); clearFormError("title"); }} placeholder="Título del gasto" />
                  </Input>
                </Field>
              </RNView>

              <RNView style={styles.row}>
                <Field label="Importe (€)" name="amount" error={formErrors.amount}>
                  <Input {...inputProps}>
                    <InputField testID="line-amount" value={amount} onChangeText={(v) => { setAmount(v); clearFormError("amount"); }} keyboardType="decimal-pad" placeholder="0,00" />
                    <InputSlot pr="$3"><RNText style={styles.adornment}>€</RNText></InputSlot>
                  </Input>
                </Field>
                <Field label="IVA (%)" name="tax" error={formErrors.tax}>
                  <Input {...inputProps}>
                    <InputField testID="line-tax" value={tax} onChangeText={(v) => { setTax(v); clearFormError("tax"); }} keyboardType="numeric" placeholder="21" />
                    <InputSlot pr="$3"><RNText style={styles.adornment}>%</RNText></InputSlot>
                  </Input>
                </Field>
                <Field label="Fecha" name="date" error={formErrors.date}>
                  <Input {...inputProps}>
                    <InputField testID="line-date" value={date ?? ""} onChangeText={(t) => { setDate(t || null); clearFormError("date"); }} placeholder="YYYY-MM-DD" />
                    <InputSlot pr="$3"><CalendarDays size={16} color={palette.textMuted} /></InputSlot>
                  </Input>
                </Field>
              </RNView>

              <RNView style={styles.row}>
                <Field label="Tipo de pago" name="idPaymentType" error={formErrors.idPaymentType}>
                  {paymentTypes && paymentTypes.length > 0 ? (
                    <Select selectedValue={idPaymentType} onValueChange={(v: string) => { setIdPaymentType(v); clearFormError("idPaymentType"); }}>
                      <SelectTrigger {...inputProps}>
                        <SelectInput placeholder="Selecciona tipo de pago" />
                        <SelectIcon mr="$3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          <SelectScrollView>
                            {paymentTypes.map((pt) => (
                              <SelectItem key={String(pt.id)} label={pt.name} value={String(pt.id)} />
                            ))}
                          </SelectScrollView>
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  ) : (
                    <Input {...inputProps}>
                      <InputField testID="line-payment" value={idPaymentType} onChangeText={setIdPaymentType} placeholder="p.ej. 1" />
                    </Input>
                  )}
                </Field>
                <Field label="Categoría" name="idCategory" error={formErrors.idCategory}>
                  {categories && categories.length > 0 ? (
                    <Select selectedValue={idCategory} onValueChange={(v: string) => { setIdCategory(v); clearFormError("idCategory"); }}>
                      <SelectTrigger {...inputProps}>
                        <SelectInput placeholder="Selecciona categoría" />
                        <SelectIcon mr="$3" />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          <SelectScrollView>
                            {categories.map((cat) => (
                              <SelectItem key={String(cat.id)} label={cat.name} value={String(cat.id)} />
                            ))}
                          </SelectScrollView>
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  ) : (
                    <Input {...inputProps}>
                      <InputField testID="line-category" value={idCategory} onChangeText={setIdCategory} placeholder="p.ej. 1" />
                    </Input>
                  )}
                </Field>
              </RNView>

              {/* Foto del ticket */}
              <RNView>
                <RNText style={styles.label}>Foto del ticket</RNText>
                {selectedPhotoName ? (
                  <RNView style={styles.photoChosen}>
                    {selectedPhotoUri ? <Image source={{ uri: selectedPhotoUri }} style={styles.thumb} accessibilityLabel="Vista previa" /> : null}
                    <RNView style={{ flex: 1 }}>
                      <RNText style={styles.photoName} numberOfLines={1}>{selectedPhotoName}</RNText>
                      <RNText style={styles.photoHint}>Se subirá al guardar la línea</RNText>
                    </RNView>
                    <IconButton testID="remove-photo" onPress={removePhoto} label="Quitar foto" danger>
                      <X size={16} color={palette.textMuted} />
                    </IconButton>
                  </RNView>
                ) : (
                  <Pressable
                    testID="attach-photo"
                    onPress={handleAttachPhoto}
                    disabled={uploadingPhoto}
                    accessibilityRole="button"
                    style={({ hovered }: any) => [styles.dropzone, hovered && styles.dropzoneHover]}
                  >
                    <RNView style={styles.dropIcon}><ImagePlus size={20} color={palette.primary} /></RNView>
                    <RNText style={styles.dropTitle}>Adjuntar imagen</RNText>
                    <RNText style={styles.photoHint}>JPG o PNG, hasta 10 MB</RNText>
                  </Pressable>
                )}
                {/* Fallback para URL manual si se desea */}
                <Input {...inputProps} mt="$2">
                  <InputField value={foto} onChangeText={setFoto} placeholder="URL manual (opcional)" autoCapitalize="none" />
                </Input>
              </RNView>

              <RNView style={styles.formActions}>
                <Button variant="outline" action="secondary" borderRadius="$lg" onPress={() => setCreateOpen(false)}>
                  <ButtonText>Cancelar</ButtonText>
                </Button>
                <Button testID="save-line" bg="$indigo600" borderRadius="$lg" isDisabled={uploadingPhoto} onPress={handleCreateLine}>
                  <ButtonText>{uploadingPhoto ? "Subiendo foto..." : "Guardar línea"}</ButtonText>
                </Button>
              </RNView>
            </RNView>
          )}

          {/* Estados y lista */}
          {loading && <LoadingState label="Cargando líneas..." compact />}
          {actionError && (
            <RNView style={{ marginBottom: 10 }}><Banner tone="danger" testID="action-error">{actionError}</Banner></RNView>
          )}
          {!loading && listError && <Banner tone="danger">{listError}</Banner>}
          {!loading && !listError && lines.length === 0 && (
            <EmptyState
              icon={<Receipt size={26} color={palette.primary} />}
              title="No hay líneas todavía"
              hint={canEditLines ? "Pulsa «Añadir línea» para registrar el primer gasto." : undefined}
            />
          )}

          {!loading && !listError && lines.length > 0 && (
            wide ? (
              <RNView style={styles.table}>
                <RNView style={styles.tableHead} testID="lines-table-head">
                  {[["Concepto", 2.4], ["Fecha", 1.3], ["Categoría", 2.4], ["Pago", 2.1], ["IVA", 0.7], ["Importe", 1.3]].map(([h, f]) => (
                    <RNText key={String(h)} style={[styles.th, { flex: Number(f), textAlign: h === "Importe" || h === "IVA" ? "right" : "left" }]}>{h}</RNText>
                  ))}
                  <RNView style={{ width: 80 }} />
                </RNView>
                {lines.map((line) => (
                  <Pressable
                    key={line.id}
                    testID={`line-row-${line.id}`}
                    style={({ hovered }: any) => [styles.tr, hovered && { backgroundColor: "#f8f8ff" }]}
                  >
                    <RNText style={[styles.td, { flex: 2.4, fontWeight: "600", color: palette.text, fontSize: 14 }]} numberOfLines={1}>{line.title}</RNText>
                    <RNText style={[styles.td, { flex: 1.3 }]}>{line.date ? formatDate(line.date) : "-"}</RNText>
                    <RNView style={{ flex: 2.4, paddingRight: 8 }}>
                      <CategoryPill name={categoryNames[String(line.id_category)]} colorKey={line.id_category} />
                    </RNView>
                    <RNView style={{ flex: 2.1, flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 8 }}>
                      <CreditCard size={14} color={palette.textMuted} />
                      <RNText style={[styles.td, { flexShrink: 1 }]} numberOfLines={1}>{paymentNames[String(line.id_payment_type)] ?? "-"}</RNText>
                    </RNView>
                    <RNText style={[styles.td, { flex: 0.7, textAlign: "right" }]}>{line.tax}%</RNText>
                    <RNText style={[styles.td, styles.amountCell, { flex: 1.3 }]}>{formatAmount(line.amount)} €</RNText>
                    <RNView style={{ width: 80, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                      {(line.foto || line.foto_path) && attachButton(line, "Abrir adjunto")}
                      {canEditLines && deleteButton(line)}
                    </RNView>
                  </Pressable>
                ))}
                <RNView style={styles.tfoot} testID="lines-total">
                  <RNText style={styles.tfootLabel}>Total</RNText>
                  <RNText style={styles.tfootValue}>{formatAmount(displayTotal)} €</RNText>
                  <RNView style={{ width: 80 }} />
                </RNView>
              </RNView>
            ) : (
              <RNView style={{ gap: 10 }}>
                {lines.map((line) => (
                  <RNView key={line.id} testID={`line-row-${line.id}`} style={styles.lineCard}>
                    <RNView style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <RNText style={[styles.lineTitle, { flex: 1 }]} numberOfLines={2}>{line.title}</RNText>
                      <RNText style={styles.lineAmount}>{formatAmount(line.amount)} €</RNText>
                    </RNView>
                    <RNView style={styles.lineMeta}>
                      <CategoryPill name={categoryNames[String(line.id_category)]} colorKey={line.id_category} />
                      {paymentNames[String(line.id_payment_type)] ? (
                        <RNView style={styles.metaItem}><CreditCard size={13} color={palette.textMuted} /><RNText style={styles.metaText}>{paymentNames[String(line.id_payment_type)]}</RNText></RNView>
                      ) : null}
                      {line.date ? (
                        <RNView style={styles.metaItem}><CalendarDays size={13} color={palette.textMuted} /><RNText style={styles.metaText}>{formatDate(line.date)}</RNText></RNView>
                      ) : null}
                      <RNText style={styles.metaText}>IVA {line.tax}%</RNText>
                    </RNView>
                    {((line.foto || line.foto_path) || canEditLines) ? (
                      <RNView style={styles.lineActions}>
                        {(line.foto || line.foto_path) && attachButton(line, Platform.OS === "web" ? "Abrir adjunto" : "Descargar adjunto", true)}
                        {canEditLines && deleteButton(line)}
                      </RNView>
                    ) : null}
                  </RNView>
                ))}
                <RNView style={styles.totalBar} testID="lines-total">
                  <RNText style={styles.tfootLabel}>Total</RNText>
                  <RNText style={styles.tfootValue}>{formatAmount(displayTotal)} €</RNText>
                </RNView>
              </RNView>
            )
          )}

          {history.length > 0 && (
            <RNView testID="sheet-history" style={styles.history}>
              <RNView style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <History size={15} color={palette.textMuted} />
                <RNText style={styles.sectionTitleSm}>Historial</RNText>
              </RNView>
              {history.map((h, i) => (
                <RNView key={h.id} testID="history-row" style={{ flexDirection: "row", gap: 12 }}>
                  <RNView style={{ alignItems: "center", width: 12 }}>
                    <RNView style={styles.tlDot} />
                    {i < history.length - 1 ? <RNView style={styles.tlLine} /> : null}
                  </RNView>
                  <RNView style={{ flex: 1, paddingBottom: i < history.length - 1 ? 14 : 0 }}>
                    <RNText style={{ fontSize: 13.5, color: palette.text }}>
                      <RNText style={{ fontWeight: "700" }}>{historyLabel(h)}</RNText>
                      {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                    </RNText>
                    <RNText style={{ fontSize: 12, color: palette.textMuted, marginTop: 1 }}>{formatDateTimeSafe(h.changed_at)}</RNText>
                    {h.note ? <RNText style={styles.note}>{`“${h.note}”`}</RNText> : null}
                  </RNView>
                </RNView>
              ))}
            </RNView>
          )}
        </ScrollView>
      </RNView>
    </Box>
  );
}

// Campo de formulario: etiqueta, control y error de validacion (que tambien se quita al corregir)
function Field({ label, name, error, children, basis = 160 }: { label: string; name: string; error?: string; children: React.ReactNode; basis?: number }) {
  return (
    <RNView style={{ flexGrow: 1, flexBasis: basis, minWidth: 0 }}>
      <RNText style={styles.label}>{label}</RNText>
      {children}
      {error ? <RNText testID={`error-${name}`} style={styles.fieldError}>{error}</RNText> : null}
    </RNView>
  );
}

// Estilo comun de los campos (esquinas redondeadas, borde que se tiñe de indigo al enfocar)
const inputProps: any = { borderRadius: "$lg", h: 44, bg: "$white", borderColor: "$coolGray300", "$focus-borderColor": "$indigo600" };

const styles = StyleSheet.create({
  panel: {
    position: "relative", width: "100%", flex: 1, backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, overflow: "hidden",
    shadowColor: "#1e1b4b", shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  strip: { position: "absolute", left: 0, right: 0, top: 0, height: 4 },
  closeBtn: { position: "absolute", right: 12, top: 14, zIndex: 1 },
  reference: { fontSize: 11.5, fontWeight: "700", color: palette.primary, letterSpacing: 0.8, marginBottom: 4, marginTop: 4 },
  title: { fontWeight: "800", color: palette.text, marginRight: 12, letterSpacing: -0.3 },
  description: { fontSize: 14, color: palette.textMuted, marginTop: 6, lineHeight: 20 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  sectionTitleSm: { fontSize: 13, fontWeight: "700", color: palette.text },
  countChip: { backgroundColor: palette.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  countChipText: { fontSize: 12, fontWeight: "700", color: palette.primary },
  loading: { textAlign: "center", color: palette.textMuted, paddingVertical: 24 },
  form: { backgroundColor: "#fafaff", borderRadius: 14, borderWidth: 1, borderColor: "#e0e2fb", padding: 16, gap: 14, marginBottom: 18 },
  formHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  formIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: palette.primarySoft, alignItems: "center", justifyContent: "center" },
  formTitle: { fontSize: 15, fontWeight: "800", color: palette.text },
  formSub: { fontSize: 12.5, color: palette.textMuted, marginTop: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  label: { fontSize: 12.5, fontWeight: "700", color: "#374151", marginBottom: 6 },
  fieldError: { color: palette.danger, fontSize: 12.5, marginTop: 4 },
  adornment: { color: palette.textMuted, fontSize: 14, fontWeight: "600" },
  dropzone: { alignItems: "center", paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#c7cbf7", backgroundColor: "#fff" },
  dropzoneHover: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  dropIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  dropTitle: { fontSize: 14, fontWeight: "700", color: palette.primary },
  photoHint: { fontSize: 12, color: palette.textMuted, marginTop: 1 },
  photoChosen: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#e5e7eb" },
  photoName: { fontSize: 13.5, fontWeight: "600", color: palette.text },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 2 },
  table: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, overflow: "hidden", backgroundColor: palette.surface },
  tableHead: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: palette.bg },
  th: { fontSize: 11, fontWeight: "700", color: palette.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 11, paddingHorizontal: 14, minHeight: 52 },
  td: { fontSize: 13.5, color: palette.textMuted },
  amountCell: { fontSize: 14.5, fontWeight: "700", color: palette.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  tfoot: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 24, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.primarySoft, paddingVertical: 12, paddingHorizontal: 14 },
  tfootLabel: { fontSize: 12, fontWeight: "700", color: palette.primary, textTransform: "uppercase", letterSpacing: 0.6 },
  tfootValue: { fontSize: 16, fontWeight: "800", color: palette.primary, minWidth: 96, textAlign: "right", fontVariant: ["tabular-nums"] },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, minWidth: 32, paddingHorizontal: 8, borderRadius: 8, justifyContent: "center" },
  attachText: { fontSize: 13, fontWeight: "600", color: palette.primary },
  lineCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface, padding: 12, gap: 8 },
  lineTitle: { fontSize: 14.5, fontWeight: "700", color: palette.text },
  lineAmount: { fontSize: 15.5, fontWeight: "800", color: palette.text, fontVariant: ["tabular-nums"] },
  lineMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12.5, color: palette.textMuted },
  lineActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 6 },
  totalBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: palette.primarySoft, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  history: { marginTop: 22, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 16 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary, marginTop: 4 },
  tlLine: { flex: 1, width: 2, backgroundColor: palette.border, marginTop: 2 },
  note: { fontSize: 13, color: palette.textMuted, marginTop: 3, fontStyle: "italic" },
});
