import { Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton, IconButton, InlineNotice, SectionHeading, Surface } from '../components/Ui';
import { getFamily, listFamilies, mergeFamilies, restoreSoftDeletedFamily, softDeleteFamily, undoMerge, type MergeSnapshot } from '../db/repositories/familyRepository';
import { getLastRecords, calculateFamilyBalance } from '../domain/balance';
import { formatINR } from '../domain/format';
import { differenceLabel, formatTranslatedDate, functionLabel, groupRecordsByYear, recordAmountLabel } from '../domain/presentation';
import { listRecords, restoreRecord, softDeleteRecord } from '../db/repositories/recordRepository';
import { listInvitations } from '../db/repositories/invitationRepository';
import { cancelInvitationReminders, scheduleInvitationReminders } from '../services/notifications';
import type { Family, FunctionRecord } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { useFamilyGroupMemberCount } from '../hooks/useNotebook';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyProfile'>;

export function FamilyProfileScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const [family, setFamily] = useState<Family | null>(null);
  const [records, setRecords] = useState<FunctionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mergePicker, setMergePicker] = useState(false);
  const [mergeSnapshot, setMergeSnapshot] = useState<MergeSnapshot | null>(null);
  const [undoDelete, setUndoDelete] = useState<{ id: string; at: string; kind: 'record' | 'family' } | null>(null);
  const [familyDeleted, setFamilyDeleted] = useState(false);
  const memberCount = useFamilyGroupMemberCount();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [familyRow, familyRecords] = await Promise.all([getFamily(route.params.familyId), listRecords(route.params.familyId)]);
      setFamily(familyRow);
      setRecords(familyRecords);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [route.params.familyId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const timer = mergeSnapshot ? setTimeout(() => setMergeSnapshot(null), 5000) : undefined;
    return () => { if (timer) clearTimeout(timer); };
  }, [mergeSnapshot]);
  useEffect(() => {
    const timer = undoDelete ? setTimeout(() => setUndoDelete(null), 5000) : undefined;
    return () => { if (timer) clearTimeout(timer); };
  }, [undoDelete]);

  const balance = useMemo(() => calculateFamilyBalance(records), [records]);
  const last = useMemo(() => getLastRecords(records), [records]);
  const theirRecords = useMemo(() => groupRecordsByYear(records.filter((record) => record.direction === 'WE_GAVE')), [records]);
  const ourRecords = useMemo(() => groupRecordsByYear(records.filter((record) => record.direction === 'THEY_GAVE')), [records]);

  const deleteRecord = (record: FunctionRecord) => {
    Alert.alert(t('settings.deleteRecord'), t('settings.deleteRecordConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.delete'), style: 'destructive', onPress: () => {
        void softDeleteRecord(record.id).then((at) => { setUndoDelete({ id: record.id, at, kind: 'record' }); return refresh(); }).catch(() => setError(true));
      } },
    ]);
  };

  const mergeInto = async (target: Family) => {
    Alert.alert(t('settings.mergeFamilies'), t('settings.mergeConfirm', { name: target.familyName }), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.mergeFamilies'), onPress: () => {
        void (async () => {
          const sourceInvitations = (await listInvitations()).filter((item) => item.familyId === route.params.familyId);
          await Promise.all(sourceInvitations.map((item) => cancelInvitationReminders(item.notificationIds)));
          const snapshot = await mergeFamilies(route.params.familyId, target.id);
          for (const item of sourceInvitations) await scheduleInvitationReminders(item.id, { requestPermission: false });
          setMergeSnapshot(snapshot);
          navigation.setParams({ familyId: target.id });
          await refresh();
        })().catch(() => setError(true));
      } },
    ]);
  };

  const undo = async () => {
    if (mergeSnapshot) {
      const previousInvitations = await listInvitations();
      await Promise.all(previousInvitations.map((item) => cancelInvitationReminders(item.notificationIds)));
      await undoMerge(mergeSnapshot);
      navigation.setParams({ familyId: mergeSnapshot.sourceId });
      setMergeSnapshot(null);
      await refresh();
      const restoredInvitations = await listInvitations();
      for (const item of restoredInvitations) await scheduleInvitationReminders(item.id, { requestPermission: false });
      return;
    }
    if (undoDelete) {
      if (undoDelete.kind === 'family') {
        await restoreSoftDeletedFamily(undoDelete.id, undoDelete.at);
        setFamilyDeleted(false);
        const restoredInvitations = (await listInvitations()).filter((item) => item.familyId === undoDelete.id);
        for (const item of restoredInvitations) await scheduleInvitationReminders(item.id, { requestPermission: false });
      } else {
        await restoreRecord(undoDelete.id, undoDelete.at);
      }
      setUndoDelete(null);
      await refresh();
    }
  };

  const deleteFamily = () => {
    if (!family) return;
    Alert.alert(t('settings.deleteFamily'), t('settings.deleteFamilyConfirm', { records: records.length }), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.delete'), style: 'destructive', onPress: () => {
        void (async () => {
          const invitations = (await listInvitations()).filter((item) => item.familyId === family.id);
          await Promise.all(invitations.map((item) => cancelInvitationReminders(item.notificationIds)));
          const { deletedAt } = await softDeleteFamily(family.id);
          setUndoDelete({ id: family.id, at: deletedAt, kind: 'family' });
          setFamilyDeleted(true);
        })().catch(() => setError(true));
      } },
    ]);
  };

  const chooseMergeTarget = async () => {
    const allFamilies = await listFamilies();
    const targets = allFamilies.filter((item) => item.id !== family?.id);
    if (!targets.length) {
      Alert.alert(t('settings.mergeChoose'), t('settings.noFamilies'));
      return;
    }
    setMergePicker(true);
  };

  const lastLine = (label: string, record: FunctionRecord | null) => (
    <View style={styles.lastLine}>
      <AppText weight="medium" style={styles.lastLabel}>{label}</AppText>
      {record ? <AppText style={styles.lastValue}>
        {(record.functionName || functionLabel(record.functionType, t))} · {formatTranslatedDate(record.date, record.datePrecision, t)} · {recordAmountLabel(record, t)}
      </AppText> : <AppText style={styles.muted}>{t('settings.noRecords')}</AppText>}
    </View>
  );

  const renderRecord = (record: FunctionRecord) => (
    <View key={record.id} style={styles.recordRow}>
      <View style={styles.recordCopy}>
        <AppText weight="semibold">{record.functionName || functionLabel(record.functionType, t)}</AppText>
        <AppText style={styles.muted}>{formatTranslatedDate(record.date, record.datePrecision, t)} · {t(record.direction === 'WE_GAVE' ? 'settings.weGave' : 'settings.theyGave')}</AppText>
        {memberCount >= 2 && record.addedBy ? <AppText style={styles.muted}>{t('settings.addedBy', { name: record.addedBy })}</AppText> : null}
      </View>
      <AppText variant="section" weight="semibold" style={styles.recordAmount}>{recordAmountLabel(record, t)}</AppText>
      <IconButton icon={Pencil} label={t('settings.edit')} onPress={() => navigation.navigate('AddRecord', { familyId: record.familyId, recordId: record.id })} />
      <IconButton icon={Trash2} label={t('settings.delete')} color={colors.danger} onPress={() => deleteRecord(record)} />
    </View>
  );

  if (loading) return <ScreenLayout title={t('settings.familyProfile')}><AppText>{t('settings.loading')}</AppText></ScreenLayout>;
  if (!family) return <ScreenLayout title={t('settings.familyProfile')}><InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice></ScreenLayout>;
  if (familyDeleted) return <ScreenLayout title={family.familyName}>
    <InlineNotice tone="warning">{t('settings.deleted')}</InlineNotice>
    {undoDelete?.kind === 'family' ? <ActionButton title={t('settings.undo')} accessibilityLabel={t('settings.undo')} onPress={() => void undo().catch(() => setError(true))} /> : null}
  </ScreenLayout>;

  return (
    <ScreenLayout title={family.familyName} right={<IconButton icon={Pencil} label={t('settings.editFamily')} onPress={() => navigation.navigate('AddFamily', { familyId: family.id })} />}>
      {error && <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice>}
      {family.place || family.relationship ? <AppText style={styles.muted}>{[family.place, family.relationship].filter(Boolean).join(' · ')}</AppText> : null}
      <Surface style={styles.summary}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}><AppText weight="medium">{t('settings.theirFunctions')}</AppText><AppText variant="section" weight="bold">{balance.theirFunctionCount}</AppText><AppText>{t('settings.weGave')} {formatINR(balance.totalGiven)}</AppText></View>
          <View style={styles.summaryCell}><AppText weight="medium">{t('settings.ourFunctions')}</AppText><AppText variant="section" weight="bold">{balance.ourFunctionCount}</AppText><AppText>{t('settings.theyGave')} {formatINR(balance.totalReceived)}</AppText></View>
        </View>
        <View style={styles.difference}><AppText weight="medium">{t('settings.difference')}</AppText><AppText variant="section" weight="semibold">{differenceLabel(balance, t)}</AppText></View>
      </Surface>

      <View style={styles.lastSection}>
        {lastLine(t('settings.lastWeGave'), last.lastWeGave)}
        {lastLine(t('settings.lastTheyGave'), last.lastTheyGave)}
      </View>

      <View>
        <SectionHeading title={t('settings.theirFunctionsHistory')} />
        {theirRecords.length ? theirRecords.map(([year, yearRecords]) => <View key={year} style={styles.yearGroup}><AppText weight="semibold" style={styles.year}>{year}</AppText>{yearRecords.map(renderRecord)}</View>) : <AppText style={styles.muted}>{t('settings.noRecords')}</AppText>}
      </View>
      <View>
        <SectionHeading title={t('settings.ourFunctionsHistory')} />
        {ourRecords.length ? ourRecords.map(([year, yearRecords]) => <View key={year} style={styles.yearGroup}><AppText weight="semibold" style={styles.year}>{year}</AppText>{yearRecords.map(renderRecord)}</View>) : <AppText style={styles.muted}>{t('settings.noRecords')}</AppText>}
      </View>

      <View style={styles.actions}>
        <ActionButton title={t('settings.addRecord')} accessibilityLabel={t('settings.addRecord')} onPress={() => navigation.navigate('AddRecord', { familyId: family.id })} />
        <ActionButton title={t('settings.setReminder')} accessibilityLabel={t('settings.setReminder')} variant="secondary" onPress={() => navigation.navigate('AddInvitation', { familyId: family.id })} />
        <ActionButton title={t('settings.mergeFamilies')} accessibilityLabel={t('settings.mergeFamilies')} variant="quiet" onPress={() => void chooseMergeTarget()} />
        <ActionButton title={t('settings.deleteFamily')} accessibilityLabel={t('settings.deleteFamily')} variant="danger" onPress={deleteFamily} />
      </View>

      {mergePicker && <Surface style={styles.mergePicker}>
        <SectionHeading title={t('settings.mergeChoose')} />
        {familiesForMerge(family, records, t, navigation, mergeInto, setMergePicker)}
        <ActionButton title={t('settings.cancel')} accessibilityLabel={t('settings.cancel')} variant="quiet" onPress={() => setMergePicker(false)} />
      </Surface>}

      {(mergeSnapshot || undoDelete) && <View style={styles.undoBar}>
        <AppText weight="semibold" style={styles.undoText}>{t(mergeSnapshot ? 'settings.mergeDone' : 'settings.deleted')}</AppText>
        <ActionButton title={t('settings.undo')} accessibilityLabel={t('settings.undo')} variant="secondary" onPress={() => void undo().catch(() => setError(true))} />
      </View>}
    </ScreenLayout>
  );
}

function familiesForMerge(
  current: Family,
  _records: FunctionRecord[],
  t: (key: string) => string,
  navigation: ReturnType<typeof useRootNavigation>,
  onChoose: (family: Family) => Promise<void>,
  close: (value: boolean) => void,
) {
  return <MergeTargetList currentId={current.id} t={t} navigation={navigation} onChoose={onChoose} close={close} />;
}

function MergeTargetList({ currentId, t: _t, navigation: _navigation, onChoose, close }: {
  currentId: string;
  t: (key: string) => string;
  navigation: ReturnType<typeof useRootNavigation>;
  onChoose: (family: Family) => Promise<void>;
  close: (value: boolean) => void;
}) {
  const [families, setFamilies] = useState<Family[]>([]);
  useEffect(() => { void listFamilies().then((items) => setFamilies(items.filter((item) => item.id !== currentId))); }, [currentId]);
  return <View style={styles.targetList}>{families.map((target) => <Pressable key={target.id} accessibilityRole="button" onPress={() => { close(false); void onChoose(target); }} style={styles.targetRow}><AppText weight="medium">{target.familyName}</AppText>{target.place ? <AppText style={styles.muted}>{target.place}</AppText> : null}</Pressable>)}</View>;
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  summary: { gap: spacing.md, padding: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryCell: { flex: 1, gap: spacing.xxs },
  difference: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, paddingTop: spacing.sm },
  lastSection: { gap: spacing.md },
  lastLine: { gap: spacing.xxs },
  lastLabel: { color: colors.muted },
  lastValue: { color: colors.ink },
  yearGroup: { marginTop: spacing.xs },
  year: { color: colors.primary, marginVertical: spacing.xs },
  recordRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.xxs, minHeight: 76, paddingVertical: spacing.xs },
  recordCopy: { flex: 1, gap: 2, minWidth: 0 },
  recordAmount: { color: colors.primary, flexShrink: 1, textAlign: 'right' },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  mergePicker: { gap: spacing.xs },
  targetList: { gap: spacing.xxs },
  targetRow: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.xs },
  undoBar: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm },
  undoText: { color: colors.white, flex: 1 },
});
