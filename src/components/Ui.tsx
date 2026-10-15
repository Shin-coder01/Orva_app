import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewProps } from 'react-native';

import { AppText } from './AppText';
import { colors, fontFamily, radii, spacing } from '../theme';
import { useSettingsStore } from '../store/settings';

type ButtonProps = {
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  busy?: boolean;
};

export function ActionButton({ title, onPress, accessibilityLabel, icon: Icon, variant = 'primary', disabled, busy }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} /> : Icon ? <Icon color={variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary} size={20} /> : null}
      <AppText weight="semibold" style={[styles.buttonText, variant === 'primary' && styles.primaryText, variant === 'danger' && styles.dangerText]}>{title}</AppText>
    </Pressable>
  );
}

export function IconButton({ icon: Icon, label, onPress, color = colors.primary }: { icon: LucideIcon; label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon color={color} size={21} />
    </Pressable>
  );
}

export function TextField({ label, style, ...props }: TextInputProps & { label: string }) {
  const language = useSettingsStore((state) => state.language) ?? 'en';
  return (
    <View style={styles.fieldWrap}>
      <AppText weight="medium" style={styles.fieldLabel}>{label}</AppText>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        style={[styles.input, { fontFamily: fontFamily(language) }, props.multiline && styles.multiline, style]}
      />
    </View>
  );
}

export function SectionHeading({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return <View style={styles.sectionHead}><AppText variant="section" weight="semibold" style={styles.sectionTitle}>{title}</AppText>{trailing}</View>;
}

export function ChoiceChip({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <AppText weight={selected ? 'semibold' : 'medium'} style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</AppText>
    </Pressable>
  );
}

export function Surface({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[styles.surface, style]}>{children}</View>;
}

export function InlineNotice({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warning' }) {
  return <View style={[styles.notice, tone === 'warning' && styles.warningNotice]}><AppText style={styles.noticeText}>{children}</AppText></View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: radii.small, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 54, paddingHorizontal: spacing.md },
  button_primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  button_secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  button_quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  button_danger: { backgroundColor: colors.surface, borderColor: colors.danger },
  buttonText: { color: colors.primary, flexShrink: 1, textAlign: 'center' },
  primaryText: { color: colors.white },
  dangerText: { color: colors.danger },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.48 },
  iconButton: { alignItems: 'center', borderRadius: radii.small, justifyContent: 'center', minHeight: 48, minWidth: 48 },
  fieldWrap: { gap: spacing.xxs, width: '100%' },
  fieldLabel: { color: colors.ink },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, color: colors.ink, fontFamily: 'NotoSans_400Regular', fontSize: 18, minHeight: 54, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlignVertical: 'center' },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle: { color: colors.ink, flexShrink: 1 },
  chip: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md },
  chipSelected: { backgroundColor: colors.primaryWash, borderColor: colors.primary },
  chipText: { color: colors.ink, flexShrink: 1, textAlign: 'center' },
  chipTextSelected: { color: colors.primary },
  surface: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, padding: spacing.md },
  notice: { backgroundColor: colors.primaryWash, borderRadius: radii.small, padding: spacing.md },
  warningNotice: { backgroundColor: colors.accentWash },
  noticeText: { color: colors.ink },
});
