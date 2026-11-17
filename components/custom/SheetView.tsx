import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  Input,
  InputField,
  Textarea,
  TextareaInput,
  Button,
  ButtonText,
  Pressable,
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
import { Platform, Linking } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { X, Plus, Trash2, CheckCircle2, XCircle, Download } from "lucide-react-native";
import { supabase } from "@/utils/supabase";
import { ExpenseLinePlain, ExpenseSheet } from "@/constants/types";
import useAux from "@/context/useAux";
import { SheetStatusID } from "@/constants/constants";
import { formatAmount, formatDateSafe, todayIso } from "@/utils/format";
import { validateLine } from "@/utils/validation";

type SheetViewProps = {
  sheet: ExpenseSheet;
  onClose?: () => void;
};

export default function SheetView({ sheet, onClose }: SheetViewProps) {
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
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<any | null>(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  useEffect(() => {
    fetchExpenseLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  const fetchExpenseLines = async () => {
    console.log("Fetch ExpenseLines")
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

  const updateSheetStatus = async (newStatusId: number) => {
    try {
      setUpdatingStatus(true);
      const { error } = await supabase
        .from("Expense_sheet")
        .update({ id_status: String(newStatusId) })
        .eq("id", sheet.id);
      if (error) {
        setActionError("No se pudo actualizar el estado de la hoja");
        return;
      }
      setStatusId(newStatusId);
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
      } catch (e) {
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
    // Subir foto a Supabase Storage si hay selección
    let finalFotoUrl = foto?.trim() || undefined;
    if (selectedPhotoUri || selectedPhotoFile) {
      try {
        setUploadingPhoto(true);
        const filename = `${Date.now()}_${selectedPhotoName ?? "foto.jpg"}`;
        const path = `expense-lines/${sheet.id}/${filename}`;
        if (Platform.OS === "web" && selectedPhotoFile) {
          await supabase.storage.from("tickets").upload(path, selectedPhotoFile, {
            contentType: selectedPhotoFile.type || "image/jpeg",
            upsert: true,
          });
        } else if (selectedPhotoUri) {
          const resp = await fetch(selectedPhotoUri);
          const blob = await resp.blob();
          await supabase.storage.from("tickets").upload(path, blob, {
            contentType: blob.type || "image/jpeg",
            upsert: true,
          });
        }
        const { data } = await supabase.storage.from("tickets").getPublicUrl(path);
        finalFotoUrl = data.publicUrl;
        setFoto(finalFotoUrl || "");
      } catch (e) {
        setActionError("Error subiendo la foto");
      } finally {
        setUploadingPhoto(false);
      }
    }

    const payload: ExpenseLinePlain = { ...validation.payload, foto: finalFotoUrl || undefined };

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
    setCreateOpen(false);
    fetchExpenseLines();
  };

  const formatDate = formatDateSafe;

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

  const FieldError = ({ name }: { name: string }) =>
    formErrors[name] ? (
      <Text color="$red600" fontSize="$sm" testID={`error-${name}`}>
        {formErrors[name]}
      </Text>
    ) : null;

  return (
    <Box flex={1} w="$full" alignItems="center" justifyContent="center">
      <Box
        position="relative"
        w="$full"
        flex={1}
        maxWidth={720}
        bg="$white"
        borderWidth={1}
        borderColor="$coolGray200"
        borderRadius="$lg"
        p={12}
      >
        <Pressable
          onPress={() => onClose?.()}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          position="absolute"
          right="$3"
          top="$3"
          zIndex={1}
          hitSlop={10}
        >
          <Icon as={X} size="lg" color="$coolGray700" />
        </Pressable>

        {/* Encabezado con datos de la hoja */}
        <VStack space="md">
          <Heading size="lg" textAlign="center">
            {sheet.title}
          </Heading>
          {sheet.description ? (
            <Text textAlign="center" color="$coolGray600">{sheet.description}</Text>
          ) : null}
          <HStack space="md" justifyContent="center">
            <Text>
              Proyecto: <Text fontWeight="$bold">{sheet.project}</Text>
            </Text>
            <Text>
              Estado: <Text fontWeight="$bold">{sheet.status?.name}</Text>
            </Text>
          </HStack>
          <HStack space="md" justifyContent="center">
            <Text>
              Total: <Text fontWeight="$bold">{formatAmount(sheet.total_amount)} €</Text>
            </Text>
            <Text color="$coolGray600">
              Creado: {formatDate(sheet.create_date)}
            </Text>
          </HStack>
        </VStack>

        {/* Acciones */}
        <HStack mt={16} mb={8} alignItems="center" justifyContent="space-between">
          <Heading size="md">Líneas de gasto</Heading>
          <HStack space="sm" alignItems="center">
            {statusId !== SheetStatusID.APROBADO && (
              <Button action="positive" isDisabled={updatingStatus} onPress={() => updateSheetStatus(SheetStatusID.APROBADO)}>
                <Icon as={CheckCircle2} />
              </Button>
            )}
            {statusId !== SheetStatusID.RECHAZADO && (
              <Button action="negative" isDisabled={updatingStatus} onPress={() => updateSheetStatus(SheetStatusID.RECHAZADO)}>
                <Icon as={XCircle} />
              </Button>
            )}
            {statusId == SheetStatusID.PENDIENTE && (<Button testID="add-line" onPress={() => setCreateOpen((x) => !x)}>
              <Icon as={Plus} mr="$2" />
              <ButtonText>Añadir línea</ButtonText>
            </Button>)}
          </HStack>
        </HStack>
        {/* Contenido desplazable: formulario + lista/estados */}
        <ScrollView
          flex={1}
          w="$full"
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator
        >
          {/* Formulario de creación dentro del scroll */}
          {createOpen && (
            <VStack space="md" mb={16}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Título</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField testID="line-title" value={title} onChangeText={setTitle} placeholder="Título del gasto" />
                </Input>
                <FieldError name="title" />
              </FormControl>

              <HStack space="md">
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Importe (€)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField testID="line-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
                  </Input>
                  <FieldError name="amount" />
                </FormControl>
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>IVA (%)</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField testID="line-tax" value={tax} onChangeText={setTax} keyboardType="numeric" placeholder="21" />
                  </Input>
                  <FieldError name="tax" />
                </FormControl>
              </HStack>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Fecha</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField testID="line-date" value={date ?? ""} onChangeText={(t) => setDate(t || null)} placeholder="YYYY-MM-DD" />
                </Input>
                <FieldError name="date" />
              </FormControl>

              <HStack space="md">
                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Tipo de pago</FormControlLabelText>
                  </FormControlLabel>
                  {paymentTypes && paymentTypes.length > 0 ? (
                    <Select
                      selectedValue={idPaymentType}
                      onValueChange={(v: string) => setIdPaymentType(v)}
                    >
                      <SelectTrigger>
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
                              <SelectItem
                                key={String(pt.id)}
                                label={pt.name}
                                value={String(pt.id)}
                              />
                            ))}
                          </SelectScrollView>
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  ) : (
                    <Input>
                      <InputField
                        testID="line-payment"
                        value={idPaymentType}
                        onChangeText={setIdPaymentType}
                        placeholder="p.ej. 1"
                      />
                    </Input>
                  )}
                  <FieldError name="idPaymentType" />
                </FormControl>

                <FormControl flex={1}>
                  <FormControlLabel>
                    <FormControlLabelText>Categoría</FormControlLabelText>
                  </FormControlLabel>
                  {categories && categories.length > 0 ? (
                    <Select
                      selectedValue={idCategory}
                      onValueChange={(v: string) => setIdCategory(v)}
                    >
                      <SelectTrigger>
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
                              <SelectItem
                                key={String(cat.id)}
                                label={cat.name}
                                value={String(cat.id)}
                              />
                            ))}
                          </SelectScrollView>
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  ) : (
                    <Input>
                      <InputField
                        testID="line-category"
                        value={idCategory}
                        onChangeText={setIdCategory}
                        placeholder="p.ej. 1"
                      />
                    </Input>
                  )}
                  <FieldError name="idCategory" />
                </FormControl>
              </HStack>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Foto</FormControlLabelText>
                </FormControlLabel>
                <HStack space="sm" alignItems="center">
                  <Button variant="outline" onPress={handleAttachPhoto} isDisabled={uploadingPhoto}>
                    <ButtonText>Adjuntar imagen</ButtonText>
                  </Button>
                  {selectedPhotoName ? (
                    <Text color="$coolGray700">{selectedPhotoName}</Text>
                  ) : null}
                </HStack>
                {/* Fallback para URL manual si se desea */}
                <Textarea mt={8}>
                  <TextareaInput value={foto} onChangeText={setFoto} placeholder="URL manual (opcional)" />
                </Textarea>
              </FormControl>

              <HStack space="sm" justifyContent="flex-end">
                <Button variant="outline" action="secondary" onPress={() => setCreateOpen(false)}>
                  <ButtonText>Cancelar</ButtonText>
                </Button>
                <Button testID="save-line" onPress={handleCreateLine}>
                  <ButtonText>Guardar línea</ButtonText>
                </Button>
              </HStack>
            </VStack>
          )}

          {/* Estados y lista */}
          {loading && <Text textAlign="center">Cargando líneas...</Text>}
          {actionError && (
            <Text textAlign="center" color="$red600" testID="action-error">{actionError}</Text>
          )}
          {!loading && listError && (
            <Text textAlign="center" color="$red600">{listError}</Text>
          )}
          {!loading && !listError && lines.length === 0 && (
            <Text textAlign="center">No hay líneas todavía</Text>
          )}

          {!loading && !listError && lines.length > 0 && (
            <>
              {lines.map((line) => (
                <Box
                  key={line.id}
                  w="$full"
                  bg="$coolGray100"
                  p={4}
                  borderRadius="$lg"
                  borderWidth={1}
                  borderColor="$coolGray200"
                  mb={8}
                >
                  <HStack alignItems="center" justifyContent="space-between" space="md">
                    <VStack space="sm" style={{ flex: 1 }}>
                      <Heading size="sm">{line.title}</Heading>
                      <HStack space="md">
                        <Text>
                          Importe: <Text fontWeight="$bold">{formatAmount(line.amount)} €</Text>
                        </Text>
                        <Text>
                          IVA: <Text fontWeight="$bold">{line.tax}%</Text>
                        </Text>
                      </HStack>
                      {line.date && (
                        <Text color="$coolGray600">Fecha: {formatDate(line.date)}</Text>
                      )}
                      {line.foto && (
                        <HStack space="xs" alignItems="center">
                          <Icon as={CheckCircle2} color="$green600" />
                        </HStack>
                      )}
                    </VStack>
                    <HStack alignItems="center" space="sm">
                      {line.foto && (
                        <Pressable
                          onPress={() => handleDownload(line.foto)}
                          accessibilityRole="button"
                          accessibilityLabel={Platform.OS === 'web' ? 'Abrir adjunto' : 'Descargar adjunto'}
                        >
                          <HStack space="xs" alignItems="center">
                            <Icon as={Download} />
                            <Text>{Platform.OS === 'web' ? 'Abrir' : 'Descargar'}</Text>
                          </HStack>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={async () => {
                          if (!line.id) return;
                          const { error } = await supabase
                            .from('Expense_line')
                            .delete()
                            .eq('id', line.id);
                          if (!error) {
                            fetchExpenseLines();
                          } else {
                            setActionError('Error eliminando la línea');
                          }
                        }}
                        accessibilityLabel="Eliminar línea"
                        accessibilityRole="button"
                        hitSlop={10}
                      >
                        <Icon as={Trash2} size="lg" color="$coolGray700" />
                      </Pressable>
                    </HStack>
                  </HStack>
                </Box>
              ))}
            </>
          )}
        </ScrollView>
      </Box>
    </Box>
  );
}
