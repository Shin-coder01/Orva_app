import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { BrandMark } from '../components/BrandMark';
import { LanguageOption } from '../components/LanguageOption';
import { useSettingsStore } from '../store/settings';
import { colors, spacing } from '../theme';

export function LanguageScreen() {
  const { t } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <View style={styles.intro}>
          <AppText variant="heading" weight="bold" style={styles.title}>
            {t('language.title')}
          </AppText>
          <AppText style={styles.description}>{t('language.description')}</AppText>
        </View>
        <View style={styles.options}>
          <LanguageOption
            label={t('language.english')}
            selected={false}
            onPress={() => setLanguage('en')}
          />
          <LanguageOption
            label={t('language.tamil')}
            selected={false}
            onPress={() => setLanguage('ta')}
          />
        </View>
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
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  },
  title: {
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.muted,
  },
  options: {
    gap: spacing.sm,
  },
});
