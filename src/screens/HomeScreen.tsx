import { House } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../components/PlaceholderScreen';

export function HomeScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.home.title')}
      message={t('screens.home.empty')}
      icon={House}
    />
  );
}
