import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { chartColors, palette } from '@/constants/theme';
import { formatAmount } from '@/utils/format';
import type { MonthPoint, Slice } from '@/utils/dashboard';

const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

/** Barras verticales (gasto mensual). El ultimo punto se resalta. */
export function BarChart({ data, height = 190 }: { data: MonthPoint[]; height?: number }) {
  // Mide el ancho real para que el texto no se deforme al estirar el SVG.
  const [width, setWidth] = useState(560);
  const max = Math.max(...data.map((d) => d.value), 1);
  const padL = 8, padB = 26, padT = 18;
  const innerH = height - padB - padT;
  const slot = (width - padL) / Math.max(data.length, 1);
  const bw = Math.min(40, slot * 0.6);
  return (
    <View onLayout={(e) => setWidth(Math.max(240, Math.round(e.nativeEvent.layout.width)))} style={{ width: '100%' }}>
    <Svg testID="bar-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <Line key={f} x1={0} x2={width} y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)} stroke={palette.border} strokeWidth={1} strokeDasharray="4 4" />
      ))}
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * innerH, d.value > 0 ? 3 : 0);
        const x = padL + slot * i + (slot - bw) / 2;
        const y = padT + innerH - h;
        const last = i === data.length - 1;
        return (
          <G key={d.key}>
            <Rect x={x} y={y} width={bw} height={h} rx={5} fill={last ? palette.primary : '#c7cbf7'} />
            {d.value > 0 ? (
              <SvgText x={x + bw / 2} y={y - 5} fontSize={11} fill={palette.textMuted} textAnchor="middle" fontFamily={FONT}>
                {Math.round(d.value)}
              </SvgText>
            ) : null}
            <SvgText x={x + bw / 2} y={height - 8} fontSize={12} fill={palette.textMuted} textAnchor="middle" fontFamily={FONT}>
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
    </View>
  );
}

/** Donut con leyenda; `center` es el texto grande del centro. */
export function Donut({
  slices, size = 150, center, colors = chartColors,
}: { slices: { id: string; label: string; value: number; color?: string }[]; size?: number; center?: { top: string; bottom: string }; colors?: string[] }) {
  const total = slices.reduce((a, x) => a + x.value, 0);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View testID="donut" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#eef0f5" strokeWidth={16} fill="none" />
        {total > 0 &&
          slices.map((sl, i) => {
            const len = (sl.value / total) * c;
            const el = (
              <Circle
                key={sl.id}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={sl.color ?? colors[i % colors.length]} strokeWidth={16}
                strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
      </Svg>
      {center ? (
        <View style={s.donutCenter} pointerEvents="none">
          <Text style={s.donutTop}>{center.top}</Text>
          <Text style={s.donutBottom}>{center.bottom}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Lista de barras horizontales con etiqueta, importe y porcentaje. */
export function HBars({ items, colors = chartColors, emptyText = 'Sin datos todavía' }: { items: Slice[]; colors?: string[]; emptyText?: string }) {
  if (items.length === 0) return <Text style={s.empty}>{emptyText}</Text>;
  return (
    <View testID="hbars">
      {items.map((it, i) => (
        <View key={it.id} style={{ marginBottom: 12 }}>
          <View style={s.hRow}>
            <View style={[s.swatch, { backgroundColor: colors[i % colors.length] }]} />
            <Text style={s.hLabel} numberOfLines={1}>{it.label}</Text>
            <Text style={s.hValue}>{formatAmount(it.value)} €</Text>
            <Text style={s.hPct}>{Math.round(it.share * 100)}%</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(it.share * 100, 2)}%`, backgroundColor: colors[i % colors.length] }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  donutCenter: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutTop: { fontSize: 22, fontWeight: '800', color: palette.text },
  donutBottom: { fontSize: 11.5, color: palette.textMuted },
  hRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  swatch: { width: 9, height: 9, borderRadius: 3, marginRight: 8 },
  hLabel: { flex: 1, fontSize: 13.5, color: palette.text, fontWeight: '500' },
  hValue: { fontSize: 13, color: palette.text, fontWeight: '600', marginLeft: 8 },
  hPct: { fontSize: 12, color: palette.textMuted, width: 38, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: '#eef0f5', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  empty: { fontSize: 13, color: palette.textMuted, paddingVertical: 12 },
});
