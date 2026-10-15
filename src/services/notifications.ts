import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '../i18n';
import type { Family, Invitation, ReminderOffset } from '../domain/types';
import { functionLabel } from '../domain/presentation';
import { getFamily, listFamilies } from '../db/repositories/familyRepository';
import { getInvitation, listInvitations, setInvitationNotificationIds } from '../db/repositories/invitationRepository';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

function localDate(date: string, hour: number): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function reminderDate(date: string, offset: ReminderOffset): Date {
  const hours: Record<ReminderOffset, number> = {
    '7D': 9,
    '1D': 9,
    MORNING_OF: 8,
    EVENING_OF: 19,
    NEXT_MORNING: 9,
  };
  const result = localDate(date, hours[offset]);
  if (offset === '7D') result.setDate(result.getDate() - 7);
  if (offset === '1D') result.setDate(result.getDate() - 1);
  if (offset === 'NEXT_MORNING') result.setDate(result.getDate() + 1);
  return result;
}

export async function cancelInvitationReminders(ids: string[]): Promise<void> {
  await Promise.all(ids.map(async (id) => {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* already delivered or removed */ }
  }));
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orva-reminders', {
      name: i18n.t('settings.reminders'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  return permission.granted;
}

export async function scheduleInvitationReminders(
  invitationId: string,
  options: { requestPermission?: boolean } = {},
): Promise<'scheduled' | 'denied' | 'none'> {
  const invitation = await getInvitation(invitationId);
  if (!invitation) return 'none';
  await cancelInvitationReminders(invitation.notificationIds);
  if (!invitation.remindersEnabled || invitation.status !== 'UPCOMING') {
    await setInvitationNotificationIds(invitationId, []);
    return 'none';
  }

  let allowed = false;
  try {
    allowed = options.requestPermission === false
      ? (await Notifications.getPermissionsAsync()).granted
      : await requestPermission();
  } catch {
    allowed = false;
  }
  if (!allowed) {
    await setInvitationNotificationIds(invitationId, []);
    return 'denied';
  }

  const family = await getFamily(invitation.familyId);
  if (!family) return 'none';
  const ids = await scheduleForInvitation(invitation, family, i18n.language);
  await setInvitationNotificationIds(invitationId, ids);
  return ids.length ? 'scheduled' : 'none';
}

async function scheduleForInvitation(invitation: Invitation, family: Family, language: string): Promise<string[]> {
  const t = i18n.getFixedT(language);
  const title = t('settings.reminderTitle');
  const functionName = invitation.functionName?.trim() || functionLabel(invitation.functionType, t);
  const body = t('settings.reminderText', { family: family.familyName, function: functionName });
  const ids: string[] = [];
  for (const offset of invitation.reminderOffsets) {
    const date = reminderDate(invitation.functionDate, offset);
    if (date.getTime() <= Date.now()) continue;
    try {
      ids.push(await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { invitationId: invitation.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === 'android' ? { channelId: 'orva-reminders' } : {}) },
      }));
    } catch {
      // A single unsupported or invalid reminder should not prevent the invitation from being saved.
    }
  }
  return ids;
}

export async function rescheduleAllInvitations(language: string): Promise<void> {
  if (Platform.OS === 'web') return;
  let allowed = false;
  try { allowed = (await Notifications.getPermissionsAsync()).granted; } catch { return; }
  if (!allowed) return;
  const [invitations, families] = await Promise.all([listInvitations(), listFamilies()]);
  const familyById = new Map(families.map((family) => [family.id, family]));
  for (const invitation of invitations) {
    await cancelInvitationReminders(invitation.notificationIds);
    if (!invitation.remindersEnabled || invitation.status !== 'UPCOMING') {
      await setInvitationNotificationIds(invitation.id, []);
      continue;
    }
    const family = familyById.get(invitation.familyId);
    const ids = family ? await scheduleForInvitation(invitation, family, language) : [];
    await setInvitationNotificationIds(invitation.id, ids);
  }
}
