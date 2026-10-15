import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton, InlineNotice, TextField } from '../components/Ui';
import { ScreenLayout } from '../components/ScreenLayout';
import { createFamily, findDuplicateFamilies, getFamily, updateFamily } from '../db/repositories/familyRepository';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddFamily'>;

export function AddFamilyScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const familyId = route.params?.familyId;
  const [familyName, setFamilyName] = useState('');
  const [place, setPlace] = useState('');
  const [primaryPerson, setPrimaryPerson] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    void getFamily(familyId).then((family) => {
      if (!family) return;
      setFamilyName(family.familyName);
      setPlace(family.place ?? '');
      setPrimaryPerson(family.primaryPerson ?? '');
      setRelationship(family.relationship ?? '');
      setPhone(family.phone ?? '');
      setNotes(family.notes ?? '');
      setMore(true);
    }).catch(() => setError(true));
  }, [familyId]);

  const save = async (allowDuplicate = false) => {
    const name = familyName.trim();
    if (!name) {
      Alert.alert(t('settings.familyName'), t('settings.familyNameRequired'));
      return;
    }
    setBusy(true);
    try {
      if (!allowDuplicate && !familyId) {
        const duplicates = await findDuplicateFamilies(name);
        if (duplicates.length) {
          const duplicate = duplicates[0];
          const message = duplicate.place
            ? t('settings.duplicateFamily', { name: duplicate.familyName, place: duplicate.place })
            : t('settings.duplicateFamilyNoPlace', { name: duplicate.familyName });
          setBusy(false);
          Alert.alert(message, undefined, [
            { text: t('settings.cancel'), style: 'cancel' },
            { text: t('settings.openIt'), onPress: () => navigation.replace('FamilyProfile', { familyId: duplicate.id }) },
            { text: t('settings.addDifferent'), onPress: () => { void save(true); } },
          ]);
          return;
        }
      }
      const input = { familyName: name, place, primaryPerson, relationship, phone, notes };
      const id = familyId ?? (await createFamily(input)).id;
      if (familyId) await updateFamily(familyId, input);
      setError(false);
      if (route.params?.returnToRecord) navigation.navigate('AddRecord', { familyId: id });
      else if (familyId) navigation.goBack();
      else navigation.replace('FamilyProfile', { familyId: id });
    } catch {
      setError(true);
      Alert.alert(t('settings.familySaveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenLayout title={t(familyId ? 'settings.editFamily' : 'settings.addFamily')}>
      {error && <InlineNotice tone="warning">{t('settings.dataError')}</InlineNotice>}
      <TextField label={t('settings.familyName')} value={familyName} onChangeText={setFamilyName} autoCapitalize="words" returnKeyType="next" />
      <ActionButton
        title={t(more ? 'settings.lessDetails' : 'settings.moreDetails')}
        accessibilityLabel={t(more ? 'settings.lessDetails' : 'settings.moreDetails')}
        variant="secondary"
        onPress={() => setMore((value) => !value)}
      />
      {more && <View style={styles.details}>
        <TextField label={t('settings.place')} value={place} onChangeText={setPlace} autoCapitalize="words" />
        <TextField label={t('settings.primaryPerson')} value={primaryPerson} onChangeText={setPrimaryPerson} autoCapitalize="words" />
        <TextField label={t('settings.relationship')} value={relationship} onChangeText={setRelationship} autoCapitalize="sentences" />
        <TextField label={t('settings.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label={t('settings.notes')} value={notes} onChangeText={setNotes} multiline />
      </View>}
      <ActionButton title={t('settings.save')} accessibilityLabel={t('settings.save')} busy={busy} onPress={() => void save()} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({ details: { gap: spacing.md, paddingTop: spacing.xs }, error: { color: colors.danger } });
