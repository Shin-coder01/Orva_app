import { ChevronDown } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { DateField, TimeField } from '../components/DateField';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton, ChoiceChip, InlineNotice, TextField } from '../components/Ui';
import { createInvitation, getInvitation, softDeleteInvitation, updateInvitation } from '../db/repositories/invitationRepository';
import { listFamilies } from '../db/repositories/familyRepository';
import { cancelInvitationReminders, scheduleInvitationReminders } from '../services/notifications';
import { formatTranslatedDate, functionLabel } from '../domain/presentation';
import { toDateOnly } from '../domain/format';
import type { Family, FunctionType, ReminderOffset } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, radii, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddInvitation'>;
const functionTypes: FunctionType[] = ['WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION', 'EAR_PIERCING', 'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER'];
const defaultOffsets: ReminderOffset[] = ['7D', '1D', 'MORNING_OF', 'EVENING_OF', 'NEXT_MORNING'];

export function AddInvitationScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyId, setFamilyId] = useState(route.params?.familyId ?? '');
  const [familyPicker, setFamilyPicker] = useState(false);
  const [functionType, setFunctionType] = useState<FunctionType>('WEDDING');
  const [functionName, setFunctionName] = useState('');
  const [functionDate, setFunctionDate] = useState(toDateOnly(new Date()));
  const [functionTime, setFunctionTime] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const selectedFamily = families.find((family) => family.id === familyId);
  const editing = Boolean(route.params?.invitationId);

  useEffect(() => {
    void Promise.all([
      listFamilies(),
      route.params?.invitationId ? getInvitation(route.params.invitationId) : Promise.resolve(null),
    ]).then(([familyRows, invitation]) => {
      setFamilies(familyRows);
      if (!invitation) return;
      setFamilyId(invitation.familyId);
      setFunctionType(invitation.functionType);
      setFunctionName(invitation.functionName ?? '');
      setFunctionDate(invitation.functionDate);
      setFunctionTime(invitation.functionTime ?? '');
      setRemindersEnabled(invitation.remindersEnabled);
    }).catch(() => setError(true));
  }, [route.params?.invitationId]);

  const save = async () => {
    if (!familyId) { Alert.alert(t('settings.chooseFamily')); return; }
    setBusy(true);
    try {
      const input = {
        familyId,
        functionType,
        functionName,
        functionDate,
        functionTime: functionTime || null,
        remindersEnabled,
        reminderOffsets: defaultOffsets,
      };
      const invitationId = route.params?.invitationId;
      let id = invitationId;
      if (invitationId) await updateInvitation(invitationId, input);
      else id = (await createInvitation(input)).id;
      if (!id) throw new Error('Missing invitation');
      let reminderState: 'scheduled' | 'denied' | 'none' = 'none';
      try { reminderState = await scheduleInvitationReminders(id, { requestPermission: remindersEnabled }); }
      catch { reminderState = 'denied'; }
      setError(false);
      if (reminderState === 'denied') {
        Alert.alert(t('settings.invitationSaved'), t('settings.remindersDenied'), [
          { text: t('settings.done'), onPress: () => navigation.goBack() },
        ]);
        return;
      }
      navigation.goBack();
    } catch {
      setError(true);
      Alert.alert(t('settings.invitationError'));
    } finally {
      setBusy(false);
    }
  };

  const removeReminder = () => {
    const invitationId = route.params?.invitationId;
    if (!invitationId) return;
    Alert.alert(t('settings.deleteReminder'), t('settings.deleteReminderConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.delete'), style: 'destructive', onPress: () => {
        void softDeleteInvitation(invitationId).then(async (notificationIds) => {
          await cancelInvitationReminders(notificationIds);
          navigation.goBack();
        }).catch(() => setError(true));
      } },
    ]);
  };

  return (
    <ScreenLayout title={t(editing ? 'settings.editReminder' : 'settings.setReminder')}>
      {error && <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice>}
      <View style={styles.fieldBlock}>
        <AppText weight="medium">{t('settings.familyName')}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={t('settings.chooseFamily')} accessibilityState={{ expanded: familyPicker }} onPress={() => setFamilyPicker((value) => !value)} style={styles.familySelect}>
          <AppText style={styles.selectedFamily}>{selectedFamily?.familyName ?? t('settings.chooseFamily')}</AppText>
          <ChevronDown color={colors.primary} size={20} />
        </Pressable>
        {familyPicker && <View style={styles.familyList}>{families.map((family) => <Pressable key={family.id} accessibilityRole="button" onPress={() => { setFamilyId(family.id); setFamilyPicker(false); }} style={styles.familyOption}><AppText>{family.familyName}</AppText></Pressable>)}</View>}
      </View>
      <View style={styles.fieldBlock}>
        <AppText weight="medium">{t('settings.function')}</AppText>
        <View style={styles.chips}>{functionTypes.map((type) => <ChoiceChip key={type} label={functionLabel(type, t)} accessibilityLabel={functionLabel(type, t)} selected={functionType === type} onPress={() => setFunctionType(type)} />)}</View>
        <TextField label={t('settings.functionName')} value={functionName} onChangeText={setFunctionName} autoCapitalize="sentences" />
      </View>
      <DateField label={t('settings.date')} value={functionDate} display={formatTranslatedDate(functionDate, 'DAY', t)} onChange={setFunctionDate} accessibilityLabel={t('settings.date')} />
      <TimeField label={t('settings.timeOptional')} value={functionTime} onChange={setFunctionTime} accessibilityLabel={t('settings.timeOptional')} />
      <View style={styles.toggleRow}>
        <View style={styles.toggleCopy}><AppText weight="semibold">{t('settings.remindersOn')}</AppText><AppText style={styles.muted}>{t('settings.reminderDetails')}</AppText></View>
        <Switch accessibilityLabel={t('settings.remindersOn')} value={remindersEnabled} onValueChange={setRemindersEnabled} trackColor={{ false: colors.border, true: colors.primaryWash }} thumbColor={remindersEnabled ? colors.primary : colors.surface} />
      </View>
      <ActionButton title={t('settings.save')} accessibilityLabel={t('settings.save')} busy={busy} onPress={() => void save()} />
      {editing ? <ActionButton title={t('settings.deleteReminder')} accessibilityLabel={t('settings.deleteReminder')} variant="danger" disabled={busy} onPress={removeReminder} /> : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { gap: spacing.sm },
  familySelect: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: spacing.md },
  selectedFamily: { flex: 1 },
  familyList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, padding: spacing.xs },
  familyOption: { justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toggleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  toggleCopy: { flex: 1, gap: spacing.xxs },
  muted: { color: colors.muted },
});
