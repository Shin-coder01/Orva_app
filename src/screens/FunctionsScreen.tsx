import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { PageFrame } from '../components/PageFrame';
import { ActionButton, ChoiceChip, IconButton, InlineNotice, SectionHeading, Surface } from '../components/Ui';
import { useFamilies, useFamilyGroupMemberCount, useRecords } from '../hooks/useNotebook';
import { restoreRecord, softDeleteRecord } from '../db/repositories/recordRepository';
import { formatTranslatedDate, functionLabel, groupRecordsByYear, recordAmountLabel } from '../domain/presentation';
import type { FunctionType, RecordDirection } from '../domain/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

const functionTypes: FunctionType[] = ['WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION', 'EAR_PIERCING', 'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER'];

export function FunctionsScreen() {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const { records, refresh } = useRecords();
  const { families } = useFamilies();
  const memberCount = useFamilyGroupMemberCount();
  const [year, setYear] = useState('all');
  const [type, setType] = useState<FunctionType | 'all'>('all');
  const [direction, setDirection] = useState<RecordDirection | 'all'>('all');
  const [familyId, setFamilyId] = useState('all');
  const [undoRecord, setUndoRecord] = useState<{ id: string; deletedAt: string } | null>(null);
  const [error, setError] = useState(false);
  const years = useMemo(() => [...new Set(records.map((record) => record.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [records]);
  const filtered = useMemo(() => records.filter((record) =>
    (year === 'all' || record.date.startsWith(year)) &&
    (type === 'all' || record.functionType === type) &&
    (direction === 'all' || record.direction === direction) &&
    (familyId === 'all' || record.familyId === familyId)), [records, year, type, direction, familyId]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);

  useEffect(() => {
    const timer = undoRecord ? setTimeout(() => setUndoRecord(null), 5000) : undefined;
    return () => { if (timer) clearTimeout(timer); };
  }, [undoRecord]);

  const removeRecord = (id: string) => {
    Alert.alert(t('settings.deleteRecord'), t('settings.deleteRecordConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.delete'), style: 'destructive', onPress: () => {
        void softDeleteRecord(id).then((deletedAt) => {
          setUndoRecord({ id, deletedAt });
          return refresh();
        }).catch(() => setError(true));
      } },
    ]);
  };

  const grouped = useMemo(() => groupRecordsByYear(filtered), [filtered]);
  return (
    <PageFrame title={t('screens.functions.title')}>
      {error ? <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice> : null}
      {undoRecord ? <Surface style={styles.undoBar}>
        <AppText weight="medium">{t('settings.deleted')}</AppText>
        <ActionButton title={t('settings.undo')} accessibilityLabel={t('settings.undo')} variant="secondary" onPress={() => void restoreRecord(undoRecord.id, undoRecord.deletedAt).then(() => { setUndoRecord(null); return refresh(); }).catch(() => setError(true))} />
      </Surface> : null}
      <Surface style={styles.filters}>
        <SectionHeading title={t('settings.filters')} />
        <AppText weight="medium">{t('settings.filterYear')}</AppText>
        <View style={styles.chips}>
          <ChoiceChip label={t('settings.allYears')} selected={year === 'all'} accessibilityLabel={t('settings.allYears')} onPress={() => setYear('all')} />
          {years.map((value) => <ChoiceChip key={value} label={value} selected={year === value} accessibilityLabel={value} onPress={() => setYear(value)} />)}
        </View>
        <AppText weight="medium">{t('settings.filterType')}</AppText>
        <View style={styles.chips}>
          <ChoiceChip label={t('settings.allTypes')} selected={type === 'all'} accessibilityLabel={t('settings.allTypes')} onPress={() => setType('all')} />
          {functionTypes.map((value) => <ChoiceChip key={value} label={functionLabel(value, t)} selected={type === value} accessibilityLabel={functionLabel(value, t)} onPress={() => setType(value)} />)}
        </View>
        <AppText weight="medium">{t('settings.filterDirection')}</AppText>
        <View style={styles.chips}>
          <ChoiceChip label={t('settings.allDirections')} selected={direction === 'all'} accessibilityLabel={t('settings.allDirections')} onPress={() => setDirection('all')} />
          <ChoiceChip label={t('settings.weGave')} selected={direction === 'WE_GAVE'} accessibilityLabel={t('settings.weGave')} onPress={() => setDirection('WE_GAVE')} />
          <ChoiceChip label={t('settings.theyGave')} selected={direction === 'THEY_GAVE'} accessibilityLabel={t('settings.theyGave')} onPress={() => setDirection('THEY_GAVE')} />
        </View>
        <AppText weight="medium">{t('settings.families')}</AppText>
        <View style={styles.chips}>
          <ChoiceChip label={t('settings.allFamilies')} selected={familyId === 'all'} accessibilityLabel={t('settings.allFamilies')} onPress={() => setFamilyId('all')} />
          {families.map((family) => <ChoiceChip key={family.id} label={family.familyName} selected={familyId === family.id} accessibilityLabel={family.familyName} onPress={() => setFamilyId(family.id)} />)}
        </View>
        <ActionButton title={t('settings.clearFilters')} accessibilityLabel={t('settings.clearFilters')} variant="quiet" onPress={() => { setYear('all'); setType('all'); setDirection('all'); setFamilyId('all'); }} />
      </Surface>
      <ActionButton title={t('settings.addRecord')} accessibilityLabel={t('settings.addRecord')} icon={Plus} onPress={() => navigation.navigate('AddRecord')} />
      {filtered.length === 0 ? <AppText style={styles.empty}>{t('settings.noRecords')}</AppText> : grouped.map(([yearGroup, yearRecords]) => <View key={yearGroup} style={styles.yearGroup}>
        <SectionHeading title={yearGroup} />
        {yearRecords.map((record) => <View key={record.id} style={styles.recordRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('settings.openFamilyWithName', { name: familyById.get(record.familyId)?.familyName ?? '' })} onPress={() => navigation.navigate('FamilyProfile', { familyId: record.familyId })} style={styles.recordCopy}>
            <AppText weight="semibold">{familyById.get(record.familyId)?.familyName ?? ''}</AppText>
            <AppText>{record.functionName || functionLabel(record.functionType, t)} · {formatTranslatedDate(record.date, record.datePrecision, t)}</AppText>
            <AppText style={styles.muted}>{t(record.direction === 'WE_GAVE' ? 'settings.weGave' : 'settings.theyGave')}</AppText>
            {memberCount >= 2 && record.addedBy ? <AppText style={styles.muted}>{t('settings.addedBy', { name: record.addedBy })}</AppText> : null}
          </Pressable>
          <AppText weight="semibold" style={styles.amount}>{recordAmountLabel(record, t)}</AppText>
          <IconButton icon={Pencil} label={t('settings.edit')} onPress={() => navigation.navigate('AddRecord', { familyId: record.familyId, recordId: record.id })} />
          <IconButton icon={Trash2} label={t('settings.delete')} color={colors.danger} onPress={() => removeRecord(record.id)} />
        </View>)}
      </View>)}
    </PageFrame>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  recordRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.xxs, minHeight: 78 },
  recordCopy: { flex: 1, gap: 2 },
  amount: { color: colors.primary, flexShrink: 1, textAlign: 'right' },
  muted: { color: colors.muted },
  yearGroup: { marginTop: spacing.sm },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
  undoBar: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
});
