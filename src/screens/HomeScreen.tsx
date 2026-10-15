import { CalendarPlus, Plus, UsersRound, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { PageFrame } from '../components/PageFrame';
import { ActionButton, IconButton, SectionHeading, Surface } from '../components/Ui';
import { useFamilies, useFamilyGroupMemberCount, useInvitations, useRecords } from '../hooks/useNotebook';
import { calculateFamilyBalance } from '../domain/balance';
import { formatINR } from '../domain/format';
import { differenceLabel, formatTranslatedDate, functionLabel, invitationFunctionLabel, recordAmountLabel } from '../domain/presentation';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { cloudEnabled } from '../cloud/client';
import { getCurrentSession, subscribeToAuthChanges } from '../cloud/auth';
import { colors, spacing } from '../theme';

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const { families } = useFamilies();
  const { records } = useRecords();
  const { invitations } = useInvitations();
  const memberCount = useFamilyGroupMemberCount();
  const [signedIn, setSignedIn] = useState(false);
  const [backupPromptDismissed, setBackupPromptDismissed] = useState(false);
  const balance = useMemo(() => calculateFamilyBalance(records), [records]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);
  const upcoming = useMemo(() => invitations.filter((item) => item.status === 'UPCOMING').sort((left, right) => left.functionDate.localeCompare(right.functionDate)), [invitations]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    if (!cloudEnabled) return;
    void getCurrentSession().then((session) => setSignedIn(Boolean(session))).catch(() => setSignedIn(false));
    return subscribeToAuthChanges((_event, session) => setSignedIn(Boolean(session)));
  }, []);

  return (
    <PageFrame title={t('screens.home.title')}>
      <View style={styles.quickActions}>
        <ActionButton title={t('settings.addRecord')} accessibilityLabel={t('settings.addRecord')} icon={Plus} onPress={() => navigation.navigate('AddRecord')} />
        <ActionButton title={t('settings.setReminder')} accessibilityLabel={t('settings.setReminder')} icon={CalendarPlus} variant="secondary" onPress={() => navigation.navigate('AddInvitation')} />
      </View>

      <View>
        <SectionHeading title={t('settings.summary')} />
        <Surface style={styles.summary}>
          <Metric label={t('settings.familyCount')} value={String(families.length)} />
          <Metric label={t('settings.functionCount')} value={String(balance.recordCount)} />
          <Metric label={t('settings.totalGiven')} value={formatINR(balance.totalGiven)} />
          <Metric label={t('settings.totalReceived')} value={formatINR(balance.totalReceived)} />
        </Surface>
      </View>

      {records.length >= 3 && !signedIn && !backupPromptDismissed ? <Surface style={styles.backupPrompt}>
        <View style={styles.backupCopy}>
          <AppText weight="semibold">{t('settings.backupNudge')}</AppText>
        </View>
        <IconButton icon={X} label={t('settings.dismissBackupNudge')} onPress={() => setBackupPromptDismissed(true)} />
        <ActionButton title={t('settings.familySettings')} accessibilityLabel={t('settings.familySettings')} variant="secondary" onPress={() => navigation.navigate('FamilyGroup')} />
      </Surface> : null}

      <View>
        <SectionHeading title={t('settings.upcoming')} />
        {upcoming.length === 0 ? <AppText style={styles.muted}>{t('settings.noUpcoming')}</AppText> : upcoming.map((invitation) => {
          const family = familyById.get(invitation.familyId);
          const familyRecords = records.filter((record) => record.familyId === invitation.familyId);
          const totals = calculateFamilyBalance(familyRecords);
          const isPast = invitation.functionDate <= todayKey;
          return <Pressable key={invitation.id} accessibilityRole="button" accessibilityLabel={t('settings.openInvitation', { family: family?.familyName ?? '', function: invitationFunctionLabel(invitation, t) })} onPress={() => navigation.navigate(isPast ? 'InvitationPrompt' : 'AddInvitation', { invitationId: invitation.id })} style={({ pressed }) => [styles.invitation, pressed && styles.pressed]}>
            <View style={styles.invitationHead}>
              <View style={styles.invitationCopy}>
                <AppText variant="section" weight="semibold">{family?.familyName ?? t('settings.familyName')}</AppText>
                <AppText>{invitationFunctionLabel(invitation, t)} · {formatTranslatedDate(invitation.functionDate, 'DAY', t)}</AppText>
              </View>
              <AppText style={styles.statusLabel}>{isPast ? t('settings.didYouGo') : t('settings.upcoming')}</AppText>
            </View>
            <View style={styles.totalsRow}>
              <AppText>{t('settings.weGave')} {formatINR(totals.totalGiven)}</AppText>
              <AppText>{t('settings.theyGave')} {formatINR(totals.totalReceived)}</AppText>
            </View>
            <AppText weight="medium">{differenceLabel(totals, t)}</AppText>
            {isPast && <AppText weight="semibold" style={styles.prompt}>{t('settings.didYouGo')}</AppText>}
          </Pressable>;
        })}
      </View>

      <View>
        <SectionHeading title={t('settings.recentRecords')} />
        {records.slice(0, 5).length === 0 ? <View style={styles.empty}><UsersRound color={colors.muted} size={24} /><AppText style={styles.muted}>{t('settings.noRecent')}</AppText></View> : records.slice(0, 5).map((record) => {
          const family = familyById.get(record.familyId);
          return <Pressable key={record.id} accessibilityRole="button" accessibilityLabel={t('settings.openFamily')} onPress={() => navigation.navigate('FamilyProfile', { familyId: record.familyId })} style={styles.recentRow}>
            <View style={styles.recentCopy}>
              <AppText weight="semibold">{family?.familyName ?? ''}</AppText>
              <AppText style={styles.muted}>{record.functionName || functionLabel(record.functionType, t)} · {formatTranslatedDate(record.date, record.datePrecision, t)}</AppText>
              {memberCount >= 2 && record.addedBy ? <AppText style={styles.muted}>{t('settings.addedBy', { name: record.addedBy })}</AppText> : null}
            </View>
            <AppText weight="semibold" style={styles.recordAmount}>{recordAmountLabel(record, t)}</AppText>
          </Pressable>;
        })}
      </View>
    </PageFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><AppText style={styles.muted}>{label}</AppText><AppText variant="section" weight="semibold" style={styles.metricValue}>{value}</AppText></View>;
}

const styles = StyleSheet.create({
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  backupPrompt: { gap: spacing.xs },
  backupCopy: { flex: 1 },
  metric: { flexBasis: '46%', flexGrow: 1, gap: spacing.xxs, minWidth: 120 },
  metricValue: { color: colors.primary },
  invitation: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.md },
  invitationHead: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  invitationCopy: { flex: 1, gap: spacing.xxs },
  statusLabel: { color: colors.primary, flexShrink: 1 },
  totalsRow: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingTop: spacing.xs },
  prompt: { color: colors.accent },
  recentRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, minHeight: 70 },
  recentCopy: { flex: 1, gap: 2 },
  recordAmount: { color: colors.primary, flexShrink: 1, textAlign: 'right' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  muted: { color: colors.muted },
  pressed: { opacity: 0.78 },
});
