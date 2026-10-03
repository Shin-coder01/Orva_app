import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radii, spacing } from '../theme';

type LanguageOptionProps = {
  label: string;
  selected: boolean;
  compact?: boolean;
  onPress: () => void;
};

export function LanguageOption({
  label,
  selected,
  compact = false,
  onPress,
}: LanguageOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        compact && styles.compact,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <AppText
        variant={compact ? 'label' : 'section'}
        weight={selected ? 'semibold' : 'medium'}
        style={styles.label}
      >
        {label}
      </AppText>
      {selected ? (
        <View style={[styles.check, compact && styles.compactCheck]}>
          <Check color={colors.white} size={18} strokeWidth={2.8} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  compact: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: spacing.sm,
  },
  selected: {
    backgroundColor: colors.primaryWash,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    color: colors.ink,
    flexShrink: 1,
    textAlign: 'center',
  },
  check: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    height: 28,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 28,
  },
  compactCheck: {
    height: 24,
    marginLeft: spacing.xs,
    width: 24,
  },
});
