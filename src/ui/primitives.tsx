import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const c = useTheme();
  return <Ionicons name={name as IconName} size={size} color={color ?? c.text} />;
}

// ------------------------------------------------------------------- text --

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'money';

const variantStyles: Record<Variant, TextStyle> = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  caption: { fontSize: 13 },
  money: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
};

export function Txt({
  variant = 'body',
  muted,
  color,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string; center?: boolean }) {
  const c = useTheme();
  return (
    <Text
      {...rest}
      style={[
        variantStyles[variant],
        { color: color ?? (muted || variant === 'label' || variant === 'caption' ? c.muted : c.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------- layout --

export function Card({
  children,
  style,
  onPress,
  tone,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'danger' | 'warning' | 'success' | 'info' | 'primary';
}) {
  const c = useTheme();
  const bg = tone
    ? { danger: c.dangerSoft, warning: c.warningSoft, success: c.successSoft, info: c.infoSoft, primary: c.primarySoft }[tone]
    : c.card;
  const content = <View style={[styles.card, { backgroundColor: bg, borderColor: c.border }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {content}
    </Pressable>
  );
}

export function Row({
  children,
  gap = spacing.sm,
  style,
  align = 'center',
  justify,
  wrap,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, gap, justifyContent: justify }, wrap && { flexWrap: 'wrap' }, style]}>
      {children}
    </View>
  );
}

export function Stack({ children, gap = spacing.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const c = useTheme();
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.bg }, padded && styles.padded]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: 96, gap: spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginTop: spacing.sm }}>
      <Txt variant="label">{children}</Txt>
      {action}
    </Row>
  );
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

// --------------------------------------------------------------- buttons --

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.primarySoft, fg: c.primary, border: c.primarySoft },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
    ghost: { bg: 'transparent', fg: c.primary, border: c.border },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Row gap={6} justify="center">
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: palette.fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  label,
  size = 22,
}: {
  name: string;
  onPress: () => void;
  color?: string;
  label: string;
  size?: number;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={name} size={size} color={color ?? c.primary} />
    </Pressable>
  );
}

export function Fab({ onPress, label, icon = 'add' }: { onPress: () => void; label: string; icon?: string }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
    >
      <Icon name={icon} size={28} color={c.onPrimary} />
    </Pressable>
  );
}

// ----------------------------------------------------------------- chips --

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  const c = useTheme();
  const accent = color ?? c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? accent : c.card,
          borderColor: selected ? accent : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Row gap={6}>
        {icon ? <Icon name={icon} size={15} color={selected ? c.onPrimary : accent} /> : null}
        <Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 14, fontWeight: selected ? '600' : '400' }}>
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => (
    <Chip key={o.value} label={o.label} icon={o.icon} selected={o.value === value} onPress={() => onChange(o.value)} />
  ));
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <Row wrap gap={spacing.sm}>
      {chips}
    </Row>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.cardAlt }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: c.card, shadowOpacity: 0.08 }]}
          >
            <Text style={{ color: selected ? c.text : c.muted, fontWeight: selected ? '700' : '500', fontSize: 14 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------- feedback --

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const c = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? c.primary }} />
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Icon name={icon} size={30} color={c.primary} />
      </View>
      <Txt variant="subtitle" center>
        {title}
      </Txt>
      {body ? (
        <Txt muted center>
          {body}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Badge({ label, tone = 'info' }: { label: string; tone?: 'danger' | 'warning' | 'success' | 'info' }) {
  const c = useTheme();
  const map = {
    danger: [c.dangerSoft, c.danger],
    warning: [c.warningSoft, c.warning],
    success: [c.successSoft, c.success],
    info: [c.infoSoft, c.info],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function CategoryIcon({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function StatBlock({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="money" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      {hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.7 : 1 }]}
    >
      {icon ? <CategoryIcon icon={icon} color={iconColor ?? c.primary} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Icon name="chevron-forward" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  padded: { padding: spacing.lg },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: spacing.md },
  buttonText: { fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radius.sm + 2,
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
