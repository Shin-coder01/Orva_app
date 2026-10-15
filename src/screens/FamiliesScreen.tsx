import { Plus, UsersRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../components/AppText';
import { PageFrame } from '../components/PageFrame';
import { ActionButton, Surface, TextField } from '../components/Ui';
import { useFamilies, useRecords } from '../hooks/useNotebook';
import { calculateFamilyBalance } from '../domain/balance';
import { formatINR } from '../domain/format';
import { differenceLabel } from '../domain/presentation';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

export function FamiliesScreen() {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const { families, error } = useFamilies();
  const { records } = useRecords();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return families;
    return families.filter((family) => [
      family.familyName,
      family.primaryPerson,
      family.place,
      family.relationship,
      family.notes,
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  }, [families, search]);
  return (
    <PageFrame title={t('screens.families.title')}>
      <TextField label={t('settings.search')} accessibilityLabel={t('settings.searchAccess')} value={search} onChangeText={setSearch} autoCapitalize="none" returnKeyType="search" />
      <ActionButton title={t('settings.addFamily')} accessibilityLabel={t('settings.addFamily')} icon={Plus} onPress={() => navigation.navigate('AddFamily')} />
      {error ? <AppText style={styles.error}>{t('settings.dataError')}</AppText> : null}
      {families.length === 0 ? <View style={styles.empty}><UsersRound color={colors.muted} size={28} /><AppText>{t('settings.noFamilies')}</AppText><ActionButton title={t('settings.addFirstFamily')} accessibilityLabel={t('settings.addFirstFamily')} onPress={() => navigation.navigate('AddFamily')} /></View> : null}
      {families.length > 0 && filtered.length === 0 ? <AppText style={styles.emptyText}>{t('settings.noResults')}</AppText> : null}
      {filtered.map((family) => {
        const balance = calculateFamilyBalance(records.filter((record) => record.familyId === family.id));
        return <Pressable key={family.id} accessibilityRole="button" accessibilityLabel={t('settings.openFamilyWithName', { name: family.familyName })} onPress={() => navigation.navigate('FamilyProfile', { familyId: family.id })} style={({ pressed }) => [pressed && styles.pressed]}>
          <Surface style={styles.familyCard}>
            <View style={styles.cardHead}><View style={styles.familyTitle}><AppText variant="section" weight="semibold">{family.familyName}</AppText>{family.place ? <AppText style={styles.muted}>{family.place}</AppText> : null}</View><AppText style={styles.count}>{balance.recordCount}</AppText></View>
            <View style={styles.totals}><AppText>{t('settings.weGave')} {formatINR(balance.totalGiven)}</AppText><AppText>{t('settings.theyGave')} {formatINR(balance.totalReceived)}</AppText></View>
            <AppText weight="medium" style={styles.difference}>{differenceLabel(balance, t)}</AppText>
          </Surface>
        </Pressable>;
      })}
    </PageFrame>
  );
}

const styles = StyleSheet.create({
  familyCard: { gap: spacing.sm, marginBottom: spacing.sm },
  cardHead: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  familyTitle: { flex: 1, gap: spacing.xxs },
  count: { alignItems: 'center', backgroundColor: colors.primaryWash, borderRadius: 14, color: colors.primary, minWidth: 32, overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, textAlign: 'center' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  difference: { color: colors.primary },
  muted: { color: colors.muted },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { paddingVertical: spacing.md, textAlign: 'center' },
  error: { color: colors.danger },
  pressed: { opacity: 0.8 },
});
