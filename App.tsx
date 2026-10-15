import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSans_500Medium } from '@expo-google-fonts/noto-sans/500Medium';
import { NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans/600SemiBold';
import { NotoSans_700Bold } from '@expo-google-fonts/noto-sans/700Bold';
import { NotoSansTamil_400Regular } from '@expo-google-fonts/noto-sans-tamil/400Regular';
import { NotoSansTamil_500Medium } from '@expo-google-fonts/noto-sans-tamil/500Medium';
import { NotoSansTamil_600SemiBold } from '@expo-google-fonts/noto-sans-tamil/600SemiBold';
import { NotoSansTamil_700Bold } from '@expo-google-fonts/noto-sans-tamil/700Bold';
import { Component, useCallback, useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { RootNavigator } from './src/navigation/RootNavigator';
import { useSettingsStore } from './src/store/settings';
import { colors } from './src/theme';
import { getDatabase } from './src/db/database';
import { AppText } from './src/components/AppText';
import { ActionButton } from './src/components/Ui';
import { AppState } from 'react-native';
import { hasPin, getLockTimeout } from './src/services/security';
import { useSecurityStore } from './src/store/security';
import { attachSyncAutoTriggers } from './src/services/sync/syncService';

type BoundaryState = { failed: boolean; revision: number };

class AppErrorBoundary extends Component<Record<string, never>, BoundaryState> {
  state: BoundaryState = { failed: false, revision: 0 };

  static getDerivedStateFromError(): Partial<BoundaryState> { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <ErrorFallback onRetry={() => this.setState((state) => ({ failed: false, revision: state.revision + 1 }))} />;
    }
    return <AppContent key={this.state.revision} />;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <View style={{ backgroundColor: colors.paper, flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <AppText variant="section" weight="semibold">{t('settings.dataError')}</AppText>
    <ActionButton title={t('settings.tryAgain')} accessibilityLabel={t('settings.tryAgain')} onPress={onRetry} />
  </View>;
}

export default function App() {
  return <AppErrorBoundary />;
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSansTamil_400Regular,
    NotoSansTamil_500Medium,
    NotoSansTamil_600SemiBold,
    NotoSansTamil_700Bold,
  });
  const hasHydrated = useSettingsStore((state) => state.hasHydrated);
  const lock = useSecurityStore((state) => state.lock);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseFailed, setDatabaseFailed] = useState(false);
  const openDatabase = useCallback(async () => {
    try {
      await getDatabase();
      setDatabaseReady(true);
      setDatabaseFailed(false);
    } catch {
      setDatabaseFailed(true);
    }
  }, []);

  useEffect(() => { void openDatabase(); }, [openDatabase]);

  useEffect(() => {
    let backgroundAt: number | null = null;
    let firstActive = true;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        backgroundAt = Date.now();
        return;
      }
      if (firstActive) {
        firstActive = false;
        return;
      }
      if (backgroundAt !== null) {
        void Promise.all([hasPin(), getLockTimeout()]).then(([enabled, timeout]) => {
          if (enabled && Date.now() - backgroundAt! >= timeout) lock();
        });
      }
      backgroundAt = null;
    });
    return () => subscription.remove();
  }, [lock]);

  useEffect(() => attachSyncAutoTriggers(), []);

  if ((!fontsLoaded && !fontError) || !hasHydrated || (!databaseReady && !databaseFailed)) {
    return <View style={{ backgroundColor: colors.paper, flex: 1 }} />;
  }

  if (databaseFailed) {
    return <SafeAreaProvider><StatusBar style="dark" /><ErrorFallback onRetry={() => { setDatabaseFailed(false); setDatabaseReady(false); void openDatabase(); }} /></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
