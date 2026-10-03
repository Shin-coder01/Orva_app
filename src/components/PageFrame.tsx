import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { BrandMark } from './BrandMark';
import { colors, spacing } from '../theme';

type PageFrameProps = PropsWithChildren<{
  title: string;
}>;

export function PageFrame({ title, children }: PageFrameProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BrandMark compact />
        <AppText variant="heading" weight="bold" style={styles.title}>
          {title}
        </AppText>
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.ink,
    marginTop: spacing.xl,
  },
  body: {
    flex: 1,
    marginTop: spacing.lg,
  },
});
