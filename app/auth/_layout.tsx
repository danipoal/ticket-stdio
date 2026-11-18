import { Slot } from "expo-router";
import { ScrollView, StyleSheet, Text, View as RNView } from "react-native";
import { View } from "@gluestack-ui/themed";
import { ScrollView as UIScrollView } from "@/components/ui/scroll-view";
import { Center } from "@/components/ui/center";
import { Ticket, BarChart3, CheckCircle2, Paperclip } from "lucide-react-native";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { palette } from "@/constants/theme";

const FEATURES = [
  { icon: Paperclip, title: "Tickets siempre a mano", text: "Adjunta la foto de cada gasto a su línea." },
  { icon: CheckCircle2, title: "Aprobación clara", text: "Cada hoja pasa de pendiente a aprobada o rechazada." },
  { icon: BarChart3, title: "Resumen al instante", text: "Gasto por mes, categoría y proyecto en un vistazo." },
];

function BrandPanel() {
  return (
    <RNView style={s.brand} testID="auth-brand">
      <RNView style={s.blobA} />
      <RNView style={s.blobB} />
      <RNView style={s.brandInner}>
        <RNView style={s.logoRow}>
          <RNView style={s.logo}><Ticket size={22} color="#fff" /></RNView>
          <Text style={s.logoText}>Ticket Stdio</Text>
        </RNView>
        <Text style={s.headline}>Tus gastos de empresa, sin papeleo.</Text>
        <Text style={s.lead}>Registra, adjunta y consulta tus hojas de gasto desde cualquier dispositivo.</Text>
        <RNView style={{ marginTop: 36, gap: 20 }}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <RNView key={title} style={s.feature}>
              <RNView style={s.featureIcon}><Icon size={18} color="#c7cbf7" /></RNView>
              <RNView style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{title}</Text>
                <Text style={s.featureText}>{text}</Text>
              </RNView>
            </RNView>
          ))}
        </RNView>
      </RNView>
    </RNView>
  );
}

export default function AuthLayout() {
  const { isDesktop } = useBreakpoint();

  if (isDesktop) {
    return (
      <RNView style={s.split} nativeID="auth-root">
        <BrandPanel />
        <ScrollView style={s.formSide} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
          <RNView style={s.formCard}>
            <Slot />
          </RNView>
        </ScrollView>
      </RNView>
    );
  }

  return (
    <View className="h-screen w-screen bg-white" nativeID="auth-root">
      <UIScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Center className="min-h-screen w-screen items-center justify-center p-4">
          <Slot />
        </Center>
      </UIScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  split: { flex: 1, flexDirection: "row", backgroundColor: "#fff" },
  brand: { flex: 1.05, backgroundColor: "#111827", overflow: "hidden", justifyContent: "center" },
  blobA: { position: "absolute", width: 520, height: 520, borderRadius: 260, backgroundColor: palette.primary, opacity: 0.35, top: -180, right: -160 },
  blobB: { position: "absolute", width: 420, height: 420, borderRadius: 210, backgroundColor: "#0891b2", opacity: 0.22, bottom: -160, left: -120 },
  brandInner: { paddingHorizontal: 72, paddingVertical: 48, maxWidth: 640 },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 48 },
  logo: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 22, fontWeight: "800", marginLeft: 12, letterSpacing: -0.4 },
  headline: { color: "#fff", fontSize: 40, fontWeight: "800", lineHeight: 46, letterSpacing: -1 },
  lead: { color: "#9ca3af", fontSize: 17, lineHeight: 26, marginTop: 16 },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  featureIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  featureTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  featureText: { color: "#9ca3af", fontSize: 14, marginTop: 2 },
  formSide: { flex: 1, backgroundColor: "#fff" },
  formContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 48 },
  formCard: { width: "100%", maxWidth: 400 },
});
