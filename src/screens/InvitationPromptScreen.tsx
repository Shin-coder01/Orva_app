import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton, InlineNotice, Surface } from '../components/Ui';
import { getFamily } from '../db/repositories/familyRepository';
import { getInvitation, setInvitationStatus } from '../db/repositories/invitationRepository';
import { createRecord } from '../db/repositories/recordRepository';
import { cancelInvitationReminders } from '../services/notifications';
import { formatTranslatedDate, invitationFunctionLabel } from '../domain/presentation';
import type { Family, Invitation } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'InvitationPrompt'>;

export function InvitationPromptScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getInvitation(route.params.invitationId).then(async (item) => {
      setInvitation(item);
      if (item) setFamily(await getFamily(item.familyId));
    }).catch(() => setError(true));
  }, [route.params.invitationId]);

  const markSkipped = async () => {
    if (!invitation) return;
    setBusy(true);
    try {
      await setInvitationStatus(invitation.id, 'SKIPPED');
      await cancelInvitationReminders(invitation.notificationIds);
      Alert.alert(t('settings.addZeroPrompt'), undefined, [
        { text: t('settings.noThanks'), style: 'cancel', onPress: () => navigation.goBack() },
        { text: t('settings.yesAdd'), onPress: () => {
          void createRecord({
            familyId: invitation.familyId,
            date: invitation.functionDate,
            datePrecision: 'DAY',
            functionType: invitation.functionType,
            functionName: invitation.functionName,
            direction: 'WE_GAVE',
            amount: 0,
          }).then(() => navigation.goBack()).catch(() => Alert.alert(t('settings.recordError')));
        } },
      ]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (!invitation || !family) {
    return <ScreenLayout title={t('settings.didYouGo')}>{error ? <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice> : <AppText>{t('settings.loading')}</AppText>}</ScreenLayout>;
  }

  if (invitation.status !== 'UPCOMING') {
    return <ScreenLayout title={t('settings.didYouGo')}>
      <InlineNotice>{t('settings.invitationAlreadyHandled')}</InlineNotice>
      <ActionButton title={t('settings.done')} accessibilityLabel={t('settings.done')} onPress={() => navigation.goBack()} />
    </ScreenLayout>;
  }

  return (
    <ScreenLayout title={t('settings.didYouGo')}>
      <Surface style={styles.invitation}>
        <AppText variant="section" weight="semibold">{family.familyName}</AppText>
        <AppText>{invitationFunctionLabel(invitation, t)}</AppText>
        <AppText style={styles.date}>{formatTranslatedDate(invitation.functionDate, 'DAY', t)}</AppText>
      </Surface>
      <View style={styles.actions}>
        <ActionButton title={t('settings.yesIWent')} accessibilityLabel={t('settings.yesIWent')} disabled={busy} onPress={() => navigation.navigate('AddRecord', {
          familyId: invitation.familyId,
          invitationId: invitation.id,
          functionType: invitation.functionType,
          functionName: invitation.functionName,
          date: invitation.functionDate,
        })} />
        <ActionButton title={t('settings.noIDidntGo')} accessibilityLabel={t('settings.noIDidntGo')} variant="secondary" busy={busy} onPress={() => void markSkipped()} />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  invitation: { gap: spacing.xs, paddingVertical: spacing.lg },
  date: { color: colors.muted },
  actions: { gap: spacing.md, marginTop: spacing.sm },
});
