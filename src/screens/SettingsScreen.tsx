import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { LanguageOption } from '../components/LanguageOption';
import { PageFrame } from '../components/PageFrame';
import type { AppLanguage } from '../i18n/types';
import { useSettingsStore } from '../store/settings';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language) ?? 'en';
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const chooseLanguage = (next: AppLanguage) => setLanguage(next);

  return (
    <PageFrame title={t('settings.title')}>
      <View>
        <AppText variant="section" weight="semibold" style={styles.label}>
          {t('settings.language')}
        </AppText>
        <View style={styles.options}>
          <LanguageOption
            compact
            label={t('language.english')}
            selected={language === 'en'}
            onPress={() => chooseLanguage('en')}
          />
          <LanguageOption
            compact
            label={t('language.tamil')}
            selected={language === 'ta'}
            onPress={() => chooseLanguage('ta')}
          />
        </View>
      </View>
    </PageFrame>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
