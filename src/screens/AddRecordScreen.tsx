import { ChevronDown, Delete, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { DateField } from '../components/DateField';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton, ChoiceChip, InlineNotice, SectionHeading, TextField } from '../components/Ui';
import { listFamilies } from '../db/repositories/familyRepository';
import { getLastAmount, getRecord, createRecord, hasDuplicateRecord, updateRecord } from '../db/repositories/recordRepository';
import { getInvitation } from '../db/repositories/invitationRepository';
import { cancelInvitationReminders } from '../services/notifications';
import { formatINR, toDateOnly } from '../domain/format';
import { formatTranslatedDate, functionLabel } from '../domain/presentation';
import type { Family, FunctionType, RecordDirection } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddRecord'>;
const functionTypes: FunctionType[] = ['WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION', 'EAR_PIERCING', 'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER'];
const quickAmounts = [500, 1000, 2000, 5000, 10000];

export function AddRecordScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const params = route.params;
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState(params?.familyId ?? '');
  const [familyPicker, setFamilyPicker] = useState(false);
  const [functionType, setFunctionType] = useState<FunctionType>(params?.functionType ?? 'WEDDING');
  const [functionName, setFunctionName] = useState(params?.functionName ?? '');
  const [date, setDate] = useState(params?.date ?? toDateOnly(new Date()));
  const [datePrecision, setDatePrecision] = useState<'DAY' | 'YEAR'>('DAY');
  const [direction, setDirection] = useState<RecordDirection | null>(null);
  const [amount, setAmount] = useState('');
  const [didntGive, setDidntGive] = useState(false);
  const [addOne, setAddOne] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [lastAmount, setLastAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const editing = Boolean(params?.recordId);
  const selectedFamily = families.find((family) => family.id === familyId);
  const displayAmount = useMemo(() => didntGive ? 0 : (Number(amount || 0) + (addOne ? 1 : 0)), [amount, addOne, didntGive]);

  useEffect(() => {
    void Promise.all([
      listFamilies(),
      params?.recordId ? getRecord(params.recordId) : Promise.resolve(null),
    ]).then(([familyRows, record]) => {
      setFamilies(familyRows);
      if (!record) return;
      setFamilyId(record.familyId);
      setFunctionType(record.functionType);
      setFunctionName(record.functionName ?? '');
      setDate(record.date);
      setDatePrecision(record.datePrecision);
      setDirection(record.direction);
      setAmount(record.amount === 0 ? '' : String(record.amount));
      setDidntGive(record.amount === 0);
      setNotes(record.notes ?? '');
      setNotesOpen(Boolean(record.notes));
    }).catch(() => setError(true));
  }, [params?.recordId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!familyId || !direction) {
        if (active) setLastAmount(null);
        return;
      }
      try {
        const value = await getLastAmount(familyId, direction);
        if (active) setLastAmount(value);
      } catch {
        if (active) setLastAmount(null);
      }
    });
    return () => { active = false; };
  }, [familyId, direction]);

  const save = async (allowDuplicate = false) => {
    if (!familyId) { Alert.alert(t('settings.chooseFamily')); return; }
    if (!direction) { Alert.alert(t('settings.chooseDirection')); return; }
    const value = displayAmount;
    if (!didntGive && !amount.trim()) { Alert.alert(t('settings.amount'), t('settings.amountInvalid')); return; }
    if (!Number.isInteger(value) || value < 0 || value > 9999999) { Alert.alert(t('settings.amount'), t('settings.amountInvalid')); return; }
    const normalizedDate = datePrecision === 'YEAR' ? `${date.slice(0, 4)}-01-01` : date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) { Alert.alert(t('settings.dateInvalid')); return; }

    if (!allowDuplicate && !editing && datePrecision === 'DAY' && await hasDuplicateRecord({ familyId, date: normalizedDate, direction })) {
      Alert.alert(t('settings.duplicateRecord'), undefined, [
        { text: t('settings.cancel'), style: 'cancel' },
        { text: t('settings.addAnyway'), onPress: () => { void save(true); } },
      ]);
      return;
    }

    setBusy(true);
    try {
      const input = {
        familyId,
        date: normalizedDate,
        datePrecision,
        functionType,
        functionName,
        direction,
        amount: value,
        notes,
        invitationId: params?.invitationId,
      };
      const invitation = params?.invitationId ? await getInvitation(params.invitationId) : null;
      if (params?.recordId) await updateRecord(params.recordId, input);
      else await createRecord(input);
      if (invitation) await cancelInvitationReminders(invitation.notificationIds);
      setError(false);
      navigation.goBack();
    } catch (cause) {
      setError(true);
      Alert.alert(t(cause instanceof Error && cause.message === 'invitation_already_handled'
        ? 'settings.invitationAlreadyHandled'
        : 'settings.recordError'));
    } finally {
      setBusy(false);
    }
  };

  const keypadPress = (digit: string) => {
    setDidntGive(false);
    setAddOne(false);
    setAmount((value) => `${value}${digit}`.replace(/^0+(?=\d)/, '').slice(0, 7));
  };
  const selectedDateDisplay = formatTranslatedDate(datePrecision === 'YEAR' ? `${date.slice(0, 4)}-01-01` : date, datePrecision, t);

  return (
    <ScreenLayout title={t(editing ? 'settings.editRecord' : 'settings.addRecord')}>
      {error && <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice>}
      <View style={styles.fieldBlock}>
        <AppText weight="medium">{t('settings.familyName')}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings.chooseFamily')} accessibilityState={{ expanded: familyPicker }} onPress={() => setFamilyPicker((value) => !value)} style={styles.familySelect}>
          <AppText style={styles.familySelected}>{selectedFamily?.familyName ?? t('settings.chooseFamily')}</AppText>
          <ChevronDown color={colors.primary} size={20} />
        </Pressable>
        {familyPicker && <View style={styles.familyList}>
          {families.map((family) => <Pressable key={family.id} accessibilityRole="button" onPress={() => { setFamilyId(family.id); setFamilyPicker(false); }} style={styles.familyOption}>
            <AppText weight={family.id === familyId ? 'semibold' : 'regular'}>{family.familyName}</AppText>
            {family.place ? <AppText variant="label" style={styles.muted}>{family.place}</AppText> : null}
          </Pressable>)}
          <ActionButton title={t('settings.addFamily')} accessibilityLabel={t('settings.addFamily')} icon={Plus} variant="secondary" onPress={() => navigation.navigate('AddFamily', { returnToRecord: true })} />
        </View>}
      </View>

      <View style={styles.fieldBlock}>
        <SectionHeading title={t('settings.function')} />
        <View style={styles.chips}>
          {functionTypes.map((type) => <ChoiceChip key={type} label={functionLabel(type, t)} accessibilityLabel={functionLabel(type, t)} selected={functionType === type} onPress={() => setFunctionType(type)} />)}
        </View>
        <TextField label={t('settings.functionName')} value={functionName} onChangeText={setFunctionName} autoCapitalize="sentences" />
      </View>

      <View style={styles.fieldBlock}>
        <DateField label={t('settings.date')} value={date} display={selectedDateDisplay} onChange={setDate} accessibilityLabel={t('settings.date')} />
        <ChoiceChip label={t('settings.yearOnly')} selected={datePrecision === 'YEAR'} accessibilityLabel={t('settings.yearOnly')} onPress={() => {
          setDatePrecision((precision) => precision === 'YEAR' ? 'DAY' : 'YEAR');
        }} />
      </View>

      <View style={styles.fieldBlock}>
        <SectionHeading title={t('settings.whoGave')} />
        <View style={styles.directionRow}>
          {(['WE_GAVE', 'THEY_GAVE'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: direction === value }} onPress={() => setDirection(value)} style={[styles.directionButton, direction === value && styles.directionSelected]}>
            <AppText weight="semibold" style={direction === value ? styles.directionSelectedText : undefined}>{t(value === 'WE_GAVE' ? 'settings.weGave' : 'settings.theyGave')}</AppText>
          </Pressable>)}
        </View>
      </View>

      <View style={styles.fieldBlock}>
        <SectionHeading title={t('settings.amount')} />
        <View style={styles.amountDisplay}><AppText variant="heading" weight="bold" style={styles.amountText}>{didntGive ? t('settings.didntGive') : formatINR(displayAmount)}</AppText></View>
        <ChoiceChip label={t('settings.didntGive')} selected={didntGive} accessibilityLabel={t('settings.didntGive')} onPress={() => { setDidntGive((value) => !value); setAmount(''); setAddOne(false); }} />
        {!didntGive && <>
          <View style={styles.chips}>
            {quickAmounts.map((value) => <ChoiceChip key={value} label={formatINR(value)} selected={Number(amount) === value && !addOne} accessibilityLabel={formatINR(value)} onPress={() => { setAmount(String(value)); setAddOne(false); }} />)}
            {lastAmount !== null && <ChoiceChip
              label={t('settings.sameAsLast', { amount: lastAmount === 0
                ? t(direction === 'WE_GAVE' ? 'settings.weDidntGive' : 'settings.theyDidntGive')
                : formatINR(lastAmount) })}
              selected={lastAmount === 0 ? didntGive : Number(amount) === lastAmount}
              accessibilityLabel={t('settings.sameAsLast', { amount: lastAmount === 0
                ? t(direction === 'WE_GAVE' ? 'settings.weDidntGive' : 'settings.theyDidntGive')
                : formatINR(lastAmount) })}
              onPress={() => { setDidntGive(lastAmount === 0); setAmount(lastAmount === 0 ? '' : String(lastAmount)); setAddOne(false); }}
            />}
            <ChoiceChip label={t('settings.addOne')} selected={addOne} accessibilityLabel={t('settings.addOne')} onPress={() => setAddOne((value) => !value)} />
          </View>
          <View style={styles.keypad}>
            {['1','2','3','4','5','6','7','8','9','clear','0','back'].map((key) => key === 'clear' || key === 'back' ? (
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={t(key === 'clear' ? 'settings.clearAmount' : 'settings.deleteDigit')} onPress={() => { setAmount((value) => key === 'clear' ? '' : value.slice(0, -1)); setAddOne(false); }} style={styles.key}>
                {key === 'back' ? <Delete color={colors.ink} size={22} /> : <AppText weight="semibold">{t('settings.clearAmount')}</AppText>}
              </Pressable>
            ) : <Pressable key={key} accessibilityRole="button" accessibilityLabel={key} onPress={() => keypadPress(key)} style={styles.key}><AppText variant="section" weight="semibold">{key}</AppText></Pressable>)}
          </View>
        </>}
      </View>

      <View style={styles.fieldBlock}>
        <ActionButton title={t(notesOpen ? 'settings.lessDetails' : 'settings.notes')} accessibilityLabel={t(notesOpen ? 'settings.lessDetails' : 'settings.notes')} variant="quiet" onPress={() => setNotesOpen((value) => !value)} />
        {notesOpen && <TextField label={t('settings.notes')} value={notes} onChangeText={setNotes} multiline />}
      </View>
      <ActionButton title={t('settings.save')} accessibilityLabel={t('settings.save')} busy={busy} onPress={() => void save()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { gap: spacing.sm },
  muted: { color: colors.muted },
  familySelect: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: spacing.md },
  familySelected: { flex: 1 },
  familyList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, gap: spacing.xs, padding: spacing.sm },
  familyOption: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  directionRow: { flexDirection: 'row', gap: spacing.sm },
  directionButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 64, padding: spacing.sm },
  directionSelected: { backgroundColor: colors.primaryWash, borderColor: colors.primary },
  directionSelectedText: { color: colors.primary },
  amountDisplay: { alignItems: 'center', justifyContent: 'center', minHeight: 72 },
  amountText: { color: colors.primary, textAlign: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  key: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, flexBasis: '31%', justifyContent: 'center', minHeight: 54 },
});
