import { Cloud, FileJson, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '../components/AppText';
import { PageFrame } from '../components/PageFrame';
import { ActionButton, ChoiceChip, InlineNotice, SectionHeading } from '../components/Ui';
import { loadSampleData } from '../db/seedSampleData';
import { pickBackupFile, restoreBackup, exportBackupToShare } from '../services/backup';
import { getBiometricEnabled, getLockTimeout, hasPin, setBiometricEnabled, setLockTimeout } from '../services/security';
import type { AppLanguage } from '../i18n/types';
import { useSettingsStore } from '../store/settings';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

const lockOptions = [0, 60000, 300000];

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricEnabled, setBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [lockTimeout, setTimeoutValue] = useState(60000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const language = useSettingsStore((state) => state.language) ?? 'en';
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
  const openPrivacy = async () => {
    if (!privacyUrl) return;
    try { await Linking.openURL(privacyUrl); }
    catch { setError(true); }
  };

  const refreshSecurity = useCallback(async () => {
    try {
      const [hasPinValue, biometricValue, timeout] = await Promise.all([hasPin(), getBiometricEnabled(), getLockTimeout()]);
      setPinEnabled(hasPinValue);
      setBiometric(biometricValue);
      setTimeoutValue(timeout);
      if (hasPinValue) {
        const LocalAuthentication = await import('expo-local-authentication');
        setBiometricAvailable(await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync());
      } else setBiometricAvailable(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => refreshSecurity()); }, [refreshSecurity]);

  const handleLoadSampleData = async () => {
    setLoadingSamples(true);
    try {
      const result = await loadSampleData();
      Alert.alert(
        result.loaded ? t('settings.samplesLoadedTitle') : t('settings.samplesExistingTitle'),
        result.loaded ? t('settings.samplesLoadedMessage', result) : t('settings.samplesExistingMessage'),
      );
    } catch {
      Alert.alert(t('settings.samplesErrorTitle'), t('settings.samplesErrorMessage'));
    } finally {
      setLoadingSamples(false);
    }
  };

  const createBackup = async () => {
    setBusy(true);
    try {
      await exportBackupToShare();
      Alert.alert(t('settings.backupExported'), t('settings.backupFileWarning'));
    } catch {
      Alert.alert(t('settings.backupShareError'));
    } finally {
      setBusy(false);
    }
  };

  const restoreFile = async () => {
    setBusy(true);
    try {
      const payload = await pickBackupFile();
      if (!payload) return;
      Alert.alert(
        t('settings.backupRestore'),
        t('settings.restoreConfirm', {
          families: payload.families.length,
          records: payload.records.length,
          invitations: payload.invitations.length,
        }),
        [
          { text: t('settings.cancel'), style: 'cancel' },
          { text: t('settings.restoreReplace'), style: 'destructive', onPress: () => {
            void restoreBackup(payload).then(() => {
              Alert.alert(t('settings.restoreSuccess'));
              void refreshSecurity();
            }).catch(() => Alert.alert(t('settings.restoreError')));
          } },
        ],
      );
    } catch {
      Alert.alert(t('settings.restoreError'));
    } finally {
      setBusy(false);
    }
  };

  const changeBiometric = async (enabled: boolean) => {
    if (enabled && !pinEnabled) {
      Alert.alert(t('settings.pinLock'), t('settings.biometricNeedsPin'));
      return;
    }
    if (enabled && !biometricAvailable) {
      Alert.alert(t('settings.biometric'), t('settings.biometricUnavailable'));
      return;
    }
    try {
      await setBiometricEnabled(enabled);
      setBiometric(enabled);
    } catch {
      setError(true);
    }
  };

  const selectLockTimeout = async (value: number) => {
    setTimeoutValue(value);
    await setLockTimeout(value);
  };

  return (
    <PageFrame title={t('settings.title')}>
      {error && <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice>}
      <View>
        <SectionHeading title={t('settings.language')} />
        <View style={styles.options}>
          <ChoiceChip label={t('language.english')} selected={language === 'en'} accessibilityLabel={t('language.english')} onPress={() => setLanguage('en' as AppLanguage)} />
          <ChoiceChip label={t('language.tamil')} selected={language === 'ta'} accessibilityLabel={t('language.tamil')} onPress={() => setLanguage('ta' as AppLanguage)} />
        </View>
      </View>

      <View>
        <SectionHeading title={t('settings.security')} />
        <ActionButton title={t(pinEnabled ? 'settings.changePin' : 'settings.setPin')} accessibilityLabel={t(pinEnabled ? 'settings.changePin' : 'settings.setPin')} icon={ShieldCheck} variant="secondary" onPress={() => navigation.navigate('PinLock', { mode: 'setup' })} />
        {pinEnabled ? <>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}><AppText weight="medium">{t('settings.biometric')}</AppText><AppText style={styles.muted}>{t('settings.biometricDescription')}</AppText></View>
            <Switch accessibilityLabel={t('settings.biometric')} value={biometricEnabled} onValueChange={(value) => void changeBiometric(value)} />
          </View>
          <AppText weight="medium">{t('settings.lockTimeout')}</AppText>
          <View style={styles.options}>{lockOptions.map((value) => <ChoiceChip key={value} label={t(value === 0 ? 'settings.lockImmediately' : value === 60000 ? 'settings.lockOneMinute' : 'settings.lockFiveMinutes')} selected={lockTimeout === value} accessibilityLabel={t(value === 0 ? 'settings.lockImmediately' : value === 60000 ? 'settings.lockOneMinute' : 'settings.lockFiveMinutes')} onPress={() => void selectLockTimeout(value)} />)}</View>
        </> : null}
      </View>

      <View>
        <SectionHeading title={t('settings.familySettings')} />
        <ActionButton title={t('settings.familySettings')} accessibilityLabel={t('settings.familySettings')} icon={Cloud} variant="secondary" onPress={() => navigation.navigate('FamilyGroup')} />
      </View>

      <View>
        <SectionHeading title={t('settings.backup')} />
        <AppText style={styles.muted}>{t('settings.backupFileWarning')}</AppText>
        <ActionButton title={t('settings.exportBackup')} accessibilityLabel={t('settings.exportBackup')} icon={FileJson} busy={busy} onPress={() => void createBackup()} />
        <ActionButton title={t('settings.restorePickFile')} accessibilityLabel={t('settings.restorePickFile')} variant="secondary" disabled={busy} onPress={() => void restoreFile()} />
      </View>

      <View>
        <SectionHeading title={t('settings.about')} />
        <AppText>{t('settings.aboutText')}</AppText>
        {privacyUrl ? <ActionButton title={t('settings.openPrivacy')} accessibilityLabel={t('settings.openPrivacy')} variant="quiet" onPress={() => void openPrivacy()} /> : <AppText style={styles.muted}>{t('settings.privacyNotAvailable')}</AppText>}
      </View>

      {__DEV__ && <View style={styles.samplesSection}>
        <SectionHeading title={t('settings.developerData')} />
        <ActionButton title={t('settings.loadSamples')} accessibilityLabel={t('settings.loadSamples')} busy={loadingSamples} variant="secondary" onPress={() => void handleLoadSampleData()} />
      </View>}
    </PageFrame>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  samplesSection: { marginTop: spacing.sm },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginTop: spacing.sm },
  toggleCopy: { flex: 1, gap: spacing.xxs },
  muted: { color: colors.muted },
});
