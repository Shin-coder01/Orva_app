import { BookOpenText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../components/PlaceholderScreen';

export function FunctionsScreen() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('screens.functions.title')}
      message={t('screens.functions.empty')}
      icon={BookOpenText}
    />
  );
}
