import { BookOpen } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { colors, radii, spacing } from '../theme';

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
        <BookOpen color={colors.primary} size={compact ? 21 : 25} strokeWidth={2.2} />
      </View>
      <AppText variant="brand" style={styles.wordmark}>
        Orva
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primaryWash,
    borderRadius: radii.medium,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  iconWrapCompact: {
    borderRadius: radii.small,
    height: 40,
    width: 40,
  },
  wordmark: {
    color: colors.ink,
  },
});
