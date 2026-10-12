// Small, dependency-light charts drawn with react-native-svg.
// Identity is never color-only: every chart has a legend or labels, values
// are shown as text next to the marks, and touch replaces hover.

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { spacing, useTheme } from '@/theme';

import { CategoryIcon, Row, Txt } from './primitives';

function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}

/** Bar with only the data-end (top) corners rounded, anchored to the baseline. */
function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export function LegendItem({ color, label, value, dashed }: { color: string; label: string; value?: string; dashed?: boolean }) {
  return (
    <Row gap={6}>
      <View
        style={{
          width: 12,
          height: dashed ? 2 : 12,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
      <Txt variant="caption">{label}</Txt>
      {value ? <Txt variant="caption" style={{ fontWeight: '700' }}>{value}</Txt> : null}
    </Row>
  );
}

// ------------------------------------------------- income vs outflows bars --

export interface PairDatum {
  label: string;
  a: number;
  b: number;
}

export function PairBars({
  data,
  labelA,
  labelB,
  format,
  height = 150,
}: {
  data: PairDatum[];
  labelA: string;
  labelB: string;
  format: (v: number) => string;
  height?: number;
}) {
  const c = useTheme();
  const [width, onLayout] = useWidth();
  const [selected, setSelected] = useState(data.length - 1);
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));
  const groupW = data.length ? width / data.length : 0;
  const barW = Math.max(4, Math.min(18, (groupW - 14) / 2));
  const sel = data[Math.min(selected, data.length - 1)];

  return (
    <View style={{ gap: spacing.sm }}>
      <Row gap={spacing.lg} wrap>
        <LegendItem color={c.chart.income} label={labelA} value={sel ? format(sel.a) : undefined} />
        <LegendItem color={c.chart.expense} label={labelB} value={sel ? format(sel.b) : undefined} />
      </Row>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={c.chart.grid} strokeWidth={1} />
            {data.map((d, i) => {
              const cx = groupW * i + groupW / 2;
              const ha = (d.a / max) * (height - 8);
              const hb = (d.b / max) * (height - 8);
              const opacity = i === selected ? 1 : 0.45;
              return [
                <Path key={`${d.label}-a`} d={topRoundedBar(cx - barW - 1, height - ha, barW, ha, 4)} fill={c.chart.income} opacity={opacity} />,
                <Path key={`${d.label}-b`} d={topRoundedBar(cx + 1, height - hb, barW, hb, 4)} fill={c.chart.expense} opacity={opacity} />,
              ];
            })}
          </Svg>
        ) : null}
        {/* Touch targets larger than the marks. */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {data.map((d, i) => (
            <Pressable
              key={d.label}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${labelA} ${format(d.a)}, ${labelB} ${format(d.b)}`}
              onPress={() => setSelected(i)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      <Row>
        {data.map((d, i) => (
          <Txt
            key={d.label}
            variant="caption"
            center
            style={{ flex: 1, fontWeight: i === selected ? '700' : '400' }}
            color={i === selected ? c.text : undefined}
          >
            {d.label}
          </Txt>
        ))}
      </Row>
    </View>
  );
}

// ---------------------------------------------------------- ranked list --

export interface RankedDatum {
  key: string;
  label: string;
  value: number;
  icon?: string;
  color: string;
  right?: string;
}

export function RankedBars({ data, format, footer }: { data: RankedDatum[]; format: (v: number) => string; footer?: ReactNode }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: spacing.md }}>
      {data.map((d) => (
        <View key={d.key} style={{ gap: 6 }}>
          <Row gap={spacing.sm}>
            {d.icon ? <CategoryIcon icon={d.icon} color={d.color} size={28} /> : null}
            <Txt style={{ flex: 1 }} numberOfLines={1}>
              {d.label}
            </Txt>
            <Txt style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{format(d.value)}</Txt>
            {d.right ? (
              <Txt variant="caption" style={{ width: 42, textAlign: 'right' }}>
                {d.right}
              </Txt>
            ) : null}
          </Row>
          <View style={{ height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${(d.value / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: d.color }} />
          </View>
        </View>
      ))}
      {footer}
    </View>
  );
}

// -------------------------------------------------------- two-part split --

export function SplitBar({
  parts,
  format,
  pct,
}: {
  parts: { label: string; value: number; color: string }[];
  format: (v: number) => string;
  pct: (r: number | null) => string;
}) {
  const c = useTheme();
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', height: 14, gap: 2, borderRadius: 7, overflow: 'hidden', backgroundColor: c.track }}>
        {total > 0
          ? parts.map((p) =>
              p.value > 0 ? <View key={p.label} style={{ flex: p.value, backgroundColor: p.color }} /> : null,
            )
          : null}
      </View>
      <Row gap={spacing.lg} wrap>
        {parts.map((p) => (
          <LegendItem key={p.label} color={p.color} label={`${p.label} ${pct(total ? p.value / total : null)}`} value={format(p.value)} />
        ))}
      </Row>
    </View>
  );
}

// ------------------------------------------------- actual vs target bars --

export function TargetBar({
  label,
  actualShare,
  targetShare,
  value,
  status,
  pct,
}: {
  label: string;
  actualShare: number | null;
  targetShare: number;
  value: string;
  status: 'good' | 'over' | 'under';
  pct: (r: number | null) => string;
}) {
  const c = useTheme();
  const color = status === 'good' ? c.success : c.warning;
  const scale = Math.max(1, (actualShare ?? 0) * 1.1, targetShare * 1.5);
  return (
    <View style={{ gap: 6 }}>
      <Row justify="space-between">
        <Txt style={{ fontWeight: '600' }}>{label}</Txt>
        <Txt variant="caption">
          <Txt style={{ fontWeight: '700' }} color={color}>
            {pct(actualShare)}
          </Txt>{' '}
          / {pct(targetShare)} · {value}
        </Txt>
      </Row>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: c.track, justifyContent: 'center' }}>
        <View
          style={{
            width: `${Math.min(1, (actualShare ?? 0) / scale) * 100}%`,
            height: 10,
            borderRadius: 5,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: `${(targetShare / scale) * 100}%`,
            width: 2,
            height: 16,
            backgroundColor: c.text,
          }}
        />
      </View>
    </View>
  );
}

// ------------------------------------------------------ balance over time --

export function BalanceLines({
  series,
  height = 140,
  xLabels,
  format,
}: {
  series: { label: string; values: number[]; color: string; dashed?: boolean }[];
  height?: number;
  xLabels: (index: number) => string;
  format: (v: number) => string;
}) {
  const c = useTheme();
  const [width, onLayout] = useWidth();
  const [cursor, setCursor] = useState<number | null>(null);
  const length = Math.max(1, ...series.map((s) => s.values.length));
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => (length <= 1 ? 0 : (i / (length - 1)) * width);
  const y = (v: number) => height - 2 - (v / max) * (height - 8);
  const idx = cursor ?? null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Row gap={spacing.lg} wrap>
        {series.map((s) => (
          <LegendItem
            key={s.label}
            color={s.color}
            dashed={s.dashed}
            label={s.label}
            value={idx !== null ? format(s.values[Math.min(idx, s.values.length - 1)] ?? 0) : undefined}
          />
        ))}
      </Row>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => width && setCursor(Math.round((e.nativeEvent.locationX / width) * (length - 1)))}
        onResponderMove={(e) =>
          width && setCursor(Math.max(0, Math.min(length - 1, Math.round((e.nativeEvent.locationX / width) * (length - 1)))))
        }
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={c.chart.grid} strokeWidth={1} />
            {series.map((s) => {
              if (!s.values.length) return null;
              const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
              return (
                <Path
                  key={s.label}
                  d={d}
                  stroke={s.color}
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  strokeLinejoin="round"
                />
              );
            })}
            {idx !== null ? (
              <Line x1={x(idx)} x2={x(idx)} y1={0} y2={height} stroke={c.muted} strokeWidth={1} strokeDasharray="3 3" />
            ) : null}
            {idx !== null
              ? series.map((s) =>
                  s.values[idx] !== undefined ? (
                    <Rect
                      key={`${s.label}-dot`}
                      x={x(idx) - 4}
                      y={y(s.values[idx]) - 4}
                      width={8}
                      height={8}
                      rx={4}
                      fill={s.color}
                      stroke={c.card}
                      strokeWidth={2}
                    />
                  ) : null,
                )
              : null}
          </Svg>
        ) : null}
      </View>
      <Row justify="space-between">
        <Txt variant="caption">{xLabels(0)}</Txt>
        {idx !== null ? (
          <Txt variant="caption" style={{ fontWeight: '700' }}>
            {xLabels(idx)}
          </Txt>
        ) : null}
        <Txt variant="caption">{xLabels(length - 1)}</Txt>
      </Row>
    </View>
  );
}
