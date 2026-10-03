import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../components/PlaceholderScreen';

export function AddScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.add.title')}
      message={t('screens.add.empty')}
      icon={Plus}
    />
  );
}
