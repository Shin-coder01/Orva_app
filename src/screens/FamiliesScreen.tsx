import { UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../components/PlaceholderScreen';

export function FamiliesScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.families.title')}
      message={t('screens.families.empty')}
      icon={UsersRound}
    />
  );
}
