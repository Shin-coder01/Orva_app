import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { ActionButton } from './Ui';
import { colors, radii, spacing } from '../theme';

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 2000, (month || 1) - 1, day || 1, 12);
}

export function DateField({ label, value, display, onChange, accessibilityLabel }: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(parseLocalDate(value));
  const { t } = useTranslation();
  const changed = (event: DateTimePickerEvent, next?: Date) => {
    if (event.type === 'set' && next) {
      if (Platform.OS === 'android') onChange(dateOnly(next));
      else setDraft(next);
    }
    if (Platform.OS === 'android' || event.type === 'dismissed') setVisible(false);
  };
  return (
    <View style={styles.field}>
      <AppText weight="medium">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { setDraft(parseLocalDate(value)); setVisible(true); }} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
        <CalendarDays color={colors.primary} size={20} />
        <AppText weight="medium">{display}</AppText>
      </Pressable>
      {visible && (Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" onRequestClose={() => setVisible(false)}>
          <Pressable style={styles.scrim} onPress={() => setVisible(false)}>
            <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHeader}><AppText variant="section" weight="semibold">{label}</AppText></View>
              <DateTimePicker value={draft} mode="date" display="spinner" onChange={changed} />
              <ActionButton title={t('settings.done')} accessibilityLabel={t('settings.done')} onPress={() => { onChange(dateOnly(draft)); setVisible(false); }} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : <DateTimePicker value={draft} mode="date" display="default" onChange={changed} />)}
    </View>
  );
}

export function dateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function TimeField({ label, value, onChange, accessibilityLabel }: { label: string; value: string; onChange: (value: string) => void; accessibilityLabel: string }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => {
    const [hour, minute] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hour || 9, minute || 0, 0, 0);
    return date;
  });
  const { t } = useTranslation();
  const changed = (event: DateTimePickerEvent, next?: Date) => {
    if (event.type === 'set' && next) {
      if (Platform.OS === 'android') onChange(`${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`);
      else setDraft(next);
    }
    if (Platform.OS === 'android' || event.type === 'dismissed') setVisible(false);
  };
  const commit = () => {
    onChange(`${String(draft.getHours()).padStart(2, '0')}:${String(draft.getMinutes()).padStart(2, '0')}`);
    setVisible(false);
  };
  return (
    <View style={styles.field}>
      <AppText weight="medium">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => setVisible(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
        <Clock3 color={colors.primary} size={20} />
        <AppText weight="medium">{value || t('settings.chooseTime')}</AppText>
      </Pressable>
      {visible && (Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" onRequestClose={() => setVisible(false)}>
          <Pressable style={styles.scrim} onPress={() => setVisible(false)}>
            <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHeader}><AppText variant="section" weight="semibold">{label}</AppText></View>
              <DateTimePicker value={draft} mode="time" display="spinner" onChange={changed} />
              <ActionButton title={t('settings.done')} accessibilityLabel={t('settings.done')} onPress={commit} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : <DateTimePicker value={draft} mode="time" display="default" onChange={changed} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xxs },
  dateButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.small, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.75 },
  scrim: { backgroundColor: 'rgba(20, 30, 26, 0.35)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radii.medium, borderTopRightRadius: radii.medium, gap: spacing.md, padding: spacing.lg },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
