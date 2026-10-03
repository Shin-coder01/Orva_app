import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { PageFrame } from './PageFrame';
import { colors, radii, spacing } from '../theme';

type PlaceholderScreenProps = {
  title: string;
  message: string;
  icon: LucideIcon;
};

export function PlaceholderScreen({ title, message, icon: Icon }: PlaceholderScreenProps) {
  return (
    <PageFrame title={title}>
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Icon color={colors.primary} size={34} strokeWidth={1.8} />
        </View>
        <AppText style={styles.message}>{message}</AppText>
      </View>
    </PageFrame>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 220,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primaryWash,
    borderRadius: radii.large,
    height: 72,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 72,
  },
  message: {
    color: colors.muted,
    maxWidth: 320,
    textAlign: 'center',
  },
});
