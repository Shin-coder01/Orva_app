import { ArrowLeft } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { IconButton } from './Ui';
import { colors, spacing } from '../theme';
import { useRootNavigation } from '../navigation/useRootNavigation';

export function ScreenLayout({ title, children, right, scroll = true, backEnabled = true }: PropsWithChildren<{ title: string; right?: ReactNode; scroll?: boolean; backEnabled?: boolean }>) {
  const navigation = useRootNavigation();
  const { t } = useTranslation();
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {backEnabled ? <IconButton icon={ArrowLeft} label={t('settings.back')} onPress={() => navigation.goBack()} /> : <View style={styles.backPlaceholder} />}
        <AppText variant="section" weight="semibold" style={styles.title}>{title}</AppText>
        <View style={styles.headerRight}>{right}</View>
      </View>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.paper, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 60, paddingHorizontal: spacing.sm },
  title: { color: colors.ink, flex: 1, paddingHorizontal: spacing.xs },
  headerRight: { alignItems: 'center', justifyContent: 'center', minWidth: 48 },
  backPlaceholder: { minHeight: 48, minWidth: 48 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  content: { flex: 1, gap: spacing.lg, padding: spacing.md },
});
