import React, { useState } from "react";
import { Button, ButtonText, Input, InputField, Textarea, TextareaInput } from "@gluestack-ui/themed";
import { StyleSheet, Text as RNText, View as RNView } from "react-native";
import { FilePlus2, X } from "lucide-react-native";
import { ExpenseSheetPlain } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";
import { validateSheet } from "@/utils/validation";
import useAuth from "@/context/useAuth";
import { Banner, IconButton } from "@/components/custom/ui";
import { palette } from "@/constants/theme";

type CreateSheetViewProps = {
  onClose?: () => void;
  /** Devuelve un mensaje de error si no se pudo crear (el formulario queda abierto) o null si fue bien. */
  onCreate?: (values: ExpenseSheetPlain) => Promise<string | null> | string | null | void;
};

// Estilo comun de los campos (esquinas redondeadas, borde que se tiñe de indigo al enfocar)
const inputProps: any = { borderRadius: "$lg", bg: "$white", borderColor: "$coolGray300", "$focus-borderColor": "$indigo600" };

export default function CreateSheetView({ onClose, onCreate }: CreateSheetViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const { employee } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // El aviso de un campo desaparece en cuanto el usuario lo corrige (antes se quedaba hasta volver a pulsar Crear)
  const clearError = (key: string) => setErrors((e) => (e[key] ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)) : e));

  const handleCreate = async () => {
    if (submitting) return;
    setSubmitError(null);
    // Una hoja nueva nace SIEMPRE pendiente y sin fecha de aprobacion; la base de datos lo exige
    // (politica RLS) y la fecha de aprobacion la fija el sistema al aprobarla.
    const validation = validateSheet({
      title,
      description,
      project,
      approvalDate: null,
      idUser: employee?.id,
      idStatus: String(SheetStatusID.PENDIENTE),
    });
    if (!validation.ok) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const err = await onCreate?.(validation.payload);
      if (err) setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RNView style={styles.wrap}>
      <RNView style={styles.panel}>
        <RNView style={styles.strip} />
        <RNView style={styles.closeBtn}>
          <IconButton onPress={() => onClose?.()} label="Cerrar">
            <X size={20} color={palette.text} />
          </IconButton>
        </RNView>

        <RNView style={styles.head}>
          <RNView style={styles.headIcon}><FilePlus2 size={20} color={palette.primary} /></RNView>
          <RNView style={{ flex: 1, paddingRight: 36 }}>
            <RNText style={styles.title}>Nueva hoja de gastos</RNText>
            <RNText style={styles.sub}>Después podrás añadir las líneas de gasto y adjuntar los tickets.</RNText>
          </RNView>
        </RNView>

        <RNView style={{ gap: 16, marginTop: 18 }}>
          <RNView>
            <RNText style={styles.label}>Título</RNText>
            <Input {...inputProps} h={44}>
              <InputField testID="sheet-title" value={title} onChangeText={(v) => { setTitle(v); clearError("title"); }} placeholder="Introduce un título" />
            </Input>
            {errors.title ? <RNText style={styles.error}>{errors.title}</RNText> : null}
          </RNView>

          <RNView>
            <RNText style={styles.label}>Descripción</RNText>
            <Textarea {...inputProps}>
              <TextareaInput value={description} onChangeText={setDescription} placeholder="Descripción opcional" />
            </Textarea>
          </RNView>

          <RNView>
            <RNText style={styles.label}>Proyecto</RNText>
            <Input {...inputProps} h={44}>
              <InputField testID="sheet-project" value={project} onChangeText={(v) => { setProject(v); clearError("project"); }} placeholder="Nombre del proyecto" onSubmitEditing={handleCreate} returnKeyType="done" />
            </Input>
            {errors.project ? <RNText style={styles.error}>{errors.project}</RNText> : null}
          </RNView>

          {submitError ? <Banner tone="danger" testID="sheet-submit-error">{submitError}</Banner> : null}

          <RNView style={styles.actions}>
            <Button variant="outline" action="secondary" borderRadius="$lg" onPress={() => onClose?.()}>
              <ButtonText>Cancelar</ButtonText>
            </Button>
            <Button testID="sheet-create" bg="$indigo600" borderRadius="$lg" onPress={handleCreate} isDisabled={submitting}>
              <ButtonText>{submitting ? "Creando..." : "Crear"}</ButtonText>
            </Button>
          </RNView>
        </RNView>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", justifyContent: "center" },
  panel: {
    position: "relative", width: "100%", maxWidth: 640, backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 22, overflow: "hidden",
    shadowColor: "#1e1b4b", shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  strip: { position: "absolute", left: 0, right: 0, top: 0, height: 4, backgroundColor: palette.primary },
  closeBtn: { position: "absolute", right: 12, top: 14, zIndex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  headIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.primarySoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: palette.text, letterSpacing: -0.3 },
  sub: { fontSize: 13, color: palette.textMuted, marginTop: 2 },
  label: { fontSize: 12.5, fontWeight: "700", color: "#374151", marginBottom: 6 },
  error: { color: palette.danger, fontSize: 12.5, marginTop: 4 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
});
