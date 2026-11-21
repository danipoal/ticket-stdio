import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Platform, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { CreditCard, ExternalLink, RefreshCw, Users, Receipt } from "lucide-react-native"
import useAuth from "@/context/useAuth"
import useBilling from "@/hooks/useBilling"
import Page from "@/components/custom/Page"
import { Banner, Card, CardTitle, PrimaryButton } from "@/components/custom/ui"
import { palette } from "@/constants/theme"
import { useBreakpoint } from "@/hooks/useBreakpoint"
import { eur, invokeBilling, limitLevel, planLabel, priceBreakdown, usagePercent } from "@/utils/billing"
import { LoadingState } from "@/components/custom/Loading"

type Notice = { tone: "info" | "success" | "danger" | "warning"; text: string }
const TONE_COLOR = { neutral: palette.textMuted, success: palette.success, warning: palette.warning, danger: palette.danger } as const
const TONE_BG = { neutral: "#f3f4f6", success: palette.successSoft, warning: palette.warningSoft, danger: palette.dangerSoft } as const

/** Abre una URL externa (Stripe Checkout / portal de cliente): en la web en la misma pestaña, para volver con el mismo navegador. */
function openExternal(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(url)
  else Linking.openURL(url)
}

export default function SubscriptionScreen() {
  const { employee, loading: authLoading } = useAuth()
  const { isDesktop } = useBreakpoint()
  const { status, loading, refresh } = useBilling()
  const params = useLocalSearchParams<{ checkout?: string; session_id?: string }>()
  const router = useRouter()
  const [busy, setBusy] = useState<null | "checkout" | "portal" | "sync">(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const busyRef = useRef(false)
  const handledReturn = useRef(false)
  const syncedFor = useRef<string | null>(null)
  const isAdmin = !!employee?.is_admin

  // Vuelta desde Stripe Checkout: se confirma la sesion sin esperar al webhook y se limpia la URL
  useEffect(() => {
    if (!isAdmin || handledReturn.current || !params.checkout) return
    handledReturn.current = true
    ;(async () => {
      if (params.checkout === "success" && params.session_id) {
        const res = await invokeBilling("confirm", { sessionId: params.session_id })
        await refresh()
        if (res.ok && res.data?.confirmed) setNotice({ tone: "success", text: "¡Suscripción activada! Ya no hay límite de tickets para tu empresa." })
        else setNotice({ tone: "info", text: "Pago recibido. La suscripción puede tardar unos segundos en activarse: recarga la página si no cambia." })
      } else if (params.checkout === "cancel") {
        setNotice({ tone: "info", text: "Has cancelado el pago. No se ha cobrado nada." })
      }
      router.replace("/subscription" as any)
    })()
  }, [isAdmin, params.checkout, params.session_id])

  // Las plazas cobradas se ajustan solas al numero de trabajadores (la primera vez que se abre la pestaña con diferencia)
  useEffect(() => {
    if (!isAdmin || !status?.paid || status.billed_seats === status.seats) return
    const key = `${status.seats}/${status.billed_seats}`
    if (syncedFor.current === key) return
    syncedFor.current = key
    ;(async () => {
      const res = await invokeBilling("sync")
      if (res.ok) await refresh()
    })()
  }, [isAdmin, status?.paid, status?.seats, status?.billed_seats])

  const go = useCallback(async (action: "checkout" | "portal" | "sync") => {
    // Referencia (no estado): dos clics en el mismo fotograma verian el estado antiguo y abririan dos pagos
    if (busyRef.current) return
    busyRef.current = true
    setBusy(action)
    setNotice(null)
    try {
      const res = await invokeBilling(action)
      if (!res.ok) {
        if (res.code === "not_configured") setNotConfigured(true)
        else setNotice({ tone: "danger", text: res.message })
        return
      }
      if (res.data?.url) openExternal(res.data.url)
      else if (action === "sync") {
        await refresh()
        setNotice({ tone: "success", text: "Plazas actualizadas." })
      }
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }, [refresh])

  if (!authLoading && !isAdmin) {
    return (
      <Page title="Suscripción">
        <Card style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={s.restrictedTitle}>Área restringida</Text>
          <Text style={s.muted}>La suscripción solo la gestiona la administración de la empresa.</Text>
        </Card>
      </Page>
    )
  }

  if (authLoading || loading) {
    return (
      <Page title="Suscripción">
        <LoadingState label="Cargando..." />
      </Page>
    )
  }

  if (!status) {
    return (
      <Page title="Suscripción">
        <Banner tone="warning" testID="billing-unavailable">No se pudo cargar el estado de la suscripción. Inténtalo de nuevo más tarde.</Banner>
      </Page>
    )
  }

  const plan = planLabel(status)
  const level = limitLevel(status)
  const percent = usagePercent(status)
  const barColor = level === "blocked" ? palette.danger : level === "low" ? palette.warning : palette.primary
  const seatsOutOfSync = status.paid && status.billed_seats !== status.seats
  const hasCustomer = status.status !== "none"
  const cardStyle = { flexGrow: 1, flexBasis: isDesktop ? "47%" : "100%", minWidth: 280 } as const

  return (
    <Page title="Suscripción" subtitle="Plan, cuota por trabajador y facturas de tu empresa" maxWidth={1100}>
      <View style={{ gap: 14 }}>
        {notice && <Banner tone={notice.tone} testID="subscription-notice">{notice.text}</Banner>}
        {notConfigured && (
          <Banner tone="info" testID="billing-not-configured">
            La pasarela de pago todavía no está activada en este servidor. En cuanto se configure podrás contratar la suscripción aquí;
            mientras tanto la empresa mantiene sus {status.free_limit} tickets gratuitos.
          </Banner>
        )}
        {level === "blocked" && (
          <Banner tone="danger" testID="billing-blocked">
            Vuestra empresa ha agotado los {status.free_limit} tickets gratuitos: nadie puede crear más hojas hasta que se active la suscripción.
          </Banner>
        )}

        <View style={s.row}>
          {/* Plan */}
          <Card style={cardStyle} testID="plan-card">
            <CardTitle title="Plan" right={<CreditCard size={18} color={palette.textMuted} />} />
            <View style={[s.pill, { backgroundColor: TONE_BG[plan.tone] }]}>
              <View style={[s.dot, { backgroundColor: TONE_COLOR[plan.tone] }]} />
              <Text testID="plan-label" style={[s.pillText, { color: TONE_COLOR[plan.tone] }]}>{plan.label}</Text>
            </View>
            <Text style={s.detail}>{plan.detail}</Text>
            <View style={s.actions}>
              {!status.paid ? (
                <PrimaryButton
                  testID="sub-checkout"
                  label={busy === "checkout" ? "Abriendo el pago..." : hasCustomer && status.status === "canceled" ? "Volver a suscribirse" : "Activar suscripción"}
                  disabled={!!busy}
                  onPress={() => go("checkout")}
                  icon={<CreditCard size={16} color="#fff" style={{ marginRight: 8 }} />}
                />
              ) : (
                <PrimaryButton
                  testID="sub-portal"
                  label={busy === "portal" ? "Abriendo el portal..." : "Gestionar pago y facturas"}
                  disabled={!!busy}
                  onPress={() => go("portal")}
                  icon={<ExternalLink size={16} color="#fff" style={{ marginRight: 8 }} />}
                />
              )}
              {!status.paid && hasCustomer && (
                <PrimaryButton testID="sub-portal-secondary" secondary label="Facturas y método de pago" disabled={!!busy} onPress={() => go("portal")} icon={<Receipt size={16} color={palette.primary} style={{ marginRight: 8 }} />} />
              )}
            </View>
          </Card>

          {/* Uso */}
          <Card style={cardStyle} testID="usage-card">
            <CardTitle title="Tickets de la empresa" subtitle="Los tickets borrados también cuentan" />
            {status.paid ? (
              <>
                <Text testID="usage-text" style={s.big}>{status.used}</Text>
                <Text style={s.muted}>tickets creados · sin límite con la suscripción</Text>
              </>
            ) : (
              <>
                <Text testID="usage-text" style={s.big}>
                  {status.used} <Text style={s.bigMuted}>de {status.free_limit} gratuitos</Text>
                </Text>
                <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: status.free_limit, now: status.used }}>
                  <View testID="usage-bar" style={[s.fill, { width: `${percent}%`, backgroundColor: barColor }]} />
                </View>
                <Text style={s.muted}>{status.can_create ? `Quedan ${status.remaining}.` : "Sin cupo: no se pueden crear más hojas."}</Text>
              </>
            )}
          </Card>
        </View>

        <View style={s.row}>
          {/* Cuota */}
          <Card style={cardStyle} testID="price-card">
            <CardTitle title="Cuota mensual" right={<Users size={18} color={palette.textMuted} />} />
            <Text testID="price-total" style={s.big}>{eur(status.monthly_cents)} <Text style={s.bigMuted}>/ mes</Text></Text>
            <Text testID="price-breakdown" style={s.detail}>{priceBreakdown(status)}</Text>
            <Text style={s.muted}>Se cobra {eur(status.price_per_seat_cents)} al mes por cada trabajador de la empresa. Al añadir o quitar personas la cuota se ajusta sola.</Text>
            {seatsOutOfSync && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Banner tone="warning" testID="seats-out-of-sync">Stripe cobra {status.billed_seats} plazas y hay {status.seats} trabajadores.</Banner>
                <View style={s.actions}>
                  <PrimaryButton testID="sub-sync" secondary label={busy === "sync" ? "Actualizando..." : "Actualizar plazas"} disabled={!!busy} onPress={() => go("sync")} icon={<RefreshCw size={16} color={palette.primary} style={{ marginRight: 8 }} />} />
                </View>
              </View>
            )}
          </Card>

          {/* Como funciona */}
          <Card style={cardStyle}>
            <CardTitle title="Cómo funciona" />
            {[
              `Cada empresa incluye ${status.free_limit} tickets gratuitos (hojas de gasto). Los borrados también cuentan.`,
              `La suscripción cuesta ${eur(status.price_per_seat_cents)} al mes por trabajador y elimina el límite.`,
              "Solo la administración puede contratar, cambiar la tarjeta, descargar facturas o cancelar.",
              "Si se agota el cupo sin suscripción, nadie de la empresa podrá crear más tickets (sí podrá consultar los existentes).",
            ].map((t) => (
              <View key={t} style={s.bullet}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>{t}</Text>
              </View>
            ))}
          </Card>
        </View>
      </View>
    </Page>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  restrictedTitle: { fontSize: 17, fontWeight: "700", color: palette.text, marginBottom: 4 },
  muted: { fontSize: 13, color: palette.textMuted, lineHeight: 19 },
  detail: { fontSize: 14, color: palette.text, marginTop: 10, lineHeight: 20 },
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  pillText: { fontSize: 13.5, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  big: { fontSize: 30, fontWeight: "800", color: palette.text, letterSpacing: -0.5, marginBottom: 6 },
  bigMuted: { fontSize: 15, fontWeight: "600", color: palette.textMuted, letterSpacing: 0 },
  track: { height: 10, borderRadius: 999, backgroundColor: "#eceef6", overflow: "hidden", marginVertical: 10 },
  fill: { height: "100%", borderRadius: 999 },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13.5, color: palette.text, lineHeight: 20 },
})
