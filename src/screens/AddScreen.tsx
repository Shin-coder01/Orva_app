import { CalendarPlus, UsersRound, WalletCards } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { PageFrame } from '../components/PageFrame';
import { ActionButton } from '../components/Ui';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { spacing } from '../theme';

export function AddScreen() {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  return (
    <PageFrame title={t('screens.add.title')}>
      <View style={styles.actions}>
        <ActionButton title={t('settings.addRecord')} accessibilityLabel={t('settings.addRecord')} icon={WalletCards} onPress={() => navigation.navigate('AddRecord')} />
        <ActionButton title={t('settings.addFamily')} accessibilityLabel={t('settings.addFamily')} icon={UsersRound} variant="secondary" onPress={() => navigation.navigate('AddFamily')} />
        <ActionButton title={t('settings.setReminder')} accessibilityLabel={t('settings.setReminder')} icon={CalendarPlus} variant="secondary" onPress={() => navigation.navigate('AddInvitation')} />
      </View>
    </PageFrame>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.md, paddingTop: spacing.md } });
