import { Delete } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton } from '../components/Ui';
import { getBiometricEnabled, hasPin, removePin, savePin, verifyPin } from '../services/security';
import { useSecurityStore } from '../store/security';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PinLock'>;
type PinPhase = 'unlock' | 'verify' | 'create' | 'confirm';

export function PinLockScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const unlock = useSecurityStore((state) => state.unlock);
  const setup = route.params?.mode === 'setup';
  const [phase, setPhase] = useState<PinPhase>(setup ? 'create' : 'unlock');
  const [pin, setPin] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifiedExistingPin, setVerifiedExistingPin] = useState(false);

  useEffect(() => {
    if (!setup) return;
    void hasPin().then((exists) => setPhase(exists ? 'verify' : 'create'));
  }, [setup]);

  useEffect(() => {
    if (setup) return;
    void getBiometricEnabled().then(async (enabled) => {
      if (!enabled) return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('settings.biometricPrompt'), cancelLabel: t('settings.cancel') });
      if (result.success) unlock();
    }).catch(() => undefined);
  }, [setup, t, unlock]);

  const submit = async () => {
    setError('');
    if (phase === 'create' && !/^\d{4,6}$/.test(pin)) { setError(t('settings.pinInvalid')); return; }
    if (phase !== 'create' && !/^\d{4,6}$/.test(pin)) { setError(t('settings.pinInvalid')); return; }
    setBusy(true);
    try {
      if (phase === 'unlock') {
        if (!(await verifyPin(pin))) { setError(t('settings.pinIncorrect')); return; }
        unlock();
        return;
      }
      if (phase === 'verify') {
        if (!(await verifyPin(pin))) { setError(t('settings.pinIncorrect')); return; }
        setVerifiedExistingPin(true);
        setPhase('create');
        setPin('');
        return;
      }
      if (phase === 'create') {
        setPendingPin(pin);
        setPin('');
        setPhase('confirm');
        return;
      }
      if (pin !== pendingPin) {
        setError(t('settings.pinMismatch'));
        setPin('');
        setPhase('create');
        return;
      }
      await savePin(pin);
      unlock();
      navigation.goBack();
    } catch {
      setError(t('settings.pinSaveError'));
    } finally {
      setBusy(false);
    }
  };

  const unlockBiometric = async () => {
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: t('settings.biometricPrompt'), cancelLabel: t('settings.cancel') });
      if (result.success) unlock();
    } catch {
      setError(t('settings.biometricError'));
    } finally {
      setBusy(false);
    }
  };

  const titleKey = phase === 'unlock' ? 'settings.pinUnlock' : phase === 'verify' ? 'settings.pinVerify' : phase === 'create' ? 'settings.pinTitle' : 'settings.pinConfirm';
  const digits = pin.split('').map(() => '●').join(' ');

  return (
    <ScreenLayout title={t(titleKey)} backEnabled={setup}>
      <AppText style={styles.description}>{t(phase === 'unlock' ? 'settings.pinUnlockDescription' : phase === 'verify' ? 'settings.pinVerifyDescription' : 'settings.pinDescription')}</AppText>
      <View accessibilityLabel={t(titleKey)} style={styles.pinDisplay}><AppText variant="heading" weight="semibold">{digits || ' '}</AppText></View>
      {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
      <View style={styles.keypad}>{['1','2','3','4','5','6','7','8','9','clear','0','back'].map((key) => <ActionButton key={key} title={key === 'back' ? '' : key === 'clear' ? t('settings.clearAmount') : key} accessibilityLabel={t(key === 'back' ? 'settings.deleteDigit' : key === 'clear' ? 'settings.clearAmount' : 'settings.pinDigit', { digit: key })} variant="secondary" icon={key === 'back' ? Delete : undefined} onPress={() => setPin((value) => key === 'clear' ? '' : key === 'back' ? value.slice(0, -1) : value.length < 6 ? `${value}${key}` : value)} />)}</View>
      <ActionButton title={t('settings.continue')} accessibilityLabel={t('settings.continue')} busy={busy} onPress={() => void submit()} />
      {phase === 'unlock' && <ActionButton title={t('settings.biometric')} accessibilityLabel={t('settings.biometric')} variant="secondary" disabled={busy} onPress={() => void unlockBiometric()} />}
      {setup && phase === 'create' && verifiedExistingPin && <ActionButton title={t('settings.removePin')} accessibilityLabel={t('settings.removePin')} variant="quiet" disabled={busy} onPress={() => Alert.alert(t('settings.removePin'), t('settings.removePinConfirm'), [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.removePin'), style: 'destructive', onPress: () => { void removePin().then(() => navigation.goBack()).catch(() => setError(t('settings.pinSaveError'))); } },
      ])} />}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  description: { color: colors.muted, textAlign: 'center' },
  pinDisplay: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 72 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
});
