import { Share2, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { ScreenLayout } from '../components/ScreenLayout';
import { ActionButton, InlineNotice, SectionHeading, Surface, TextField } from '../components/Ui';
import { cloudEnabled } from '../cloud/client';
import { getAccountTransition } from '../cloud/accountRules';
import { deleteCloudAccount, getCurrentSession, sendCode, signOut, subscribeToAuthChanges, verifyCode } from '../cloud/auth';
import { createFamilyInvite, findMyFamilyGroup, joinFamilyGroup, leaveFamilyGroup, loadFamilyGroupMembers, startFamilyGroup, updateMyDisplayName, type FamilyGroupMember } from '../cloud/familyGroup';
import { clearNotebook, listInvitations } from '../db/repositories/invitationRepository';
import { deleteSyncValues, getSyncValue, markAllRowsDirty, resetPullCursors, setSyncValue } from '../db/repositories/syncStateRepository';
import { exportBackupToShare } from '../services/backup';
import { cancelInvitationReminders } from '../services/notifications';
import { syncNow } from '../services/sync/syncService';
import { useSyncStore } from '../store/sync';
import type { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FamilyGroup'>;

export function FamilyGroupScreen(_props: Props) {
  const { t } = useTranslation();
  const navigation = useRootNavigation();
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<FamilyGroupMember[]>([]);
  const [groupId, setGroupId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [sentCode, setSentCode] = useState(false);
  const [joining, setJoining] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [memberLoadError, setMemberLoadError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [accountChanged, setAccountChanged] = useState(false);
  const syncStatus = useSyncStore((state) => state.status);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const setLastSyncedAt = useSyncStore((state) => state.setLastSyncedAt);

  const load = useCallback(async (activeSession?: Session | null) => {
    try {
      const current = activeSession === undefined ? await getCurrentSession() : activeSession;
      setSession(current);
      if (!current) {
        setMembers([]);
        setGroupId('');
        return;
      }
      const previousAccount = await getSyncValue('accountUserId');
      const accountTransition = getAccountTransition(previousAccount, current.user.id);
      if (accountTransition === 'different-account') {
        setAccountChanged(true);
        setGroupId('');
        setMembers([]);
        return;
      }
      setAccountChanged(false);
      if (accountTransition === 'first-sync') await setSyncValue('accountUserId', current.user.id);
      const [savedName, savedGroup, dirty, lastSynced] = await Promise.all([
        getSyncValue('displayName'),
        getSyncValue('cloudHouseholdId'),
        import('../db/repositories/syncStateRepository').then(({ countDirtyRows }) => countDirtyRows()),
        getSyncValue('lastSyncedAt'),
      ]);
      setLastSyncedAt(lastSynced);
      let groupIdValue = savedGroup;
      let displayNameValue = savedName;
      if (!groupIdValue) {
        const remoteGroup = await findMyFamilyGroup();
        if (remoteGroup) {
          groupIdValue = remoteGroup.householdId;
          displayNameValue = remoteGroup.displayName ?? displayNameValue;
          await setSyncValue('cloudHouseholdId', groupIdValue);
          if (displayNameValue) await setSyncValue('displayName', displayNameValue);
          await resetPullCursors();
          await markAllRowsDirty();
        }
      }
      setDisplayName(displayNameValue ?? '');
      setNameInput(displayNameValue ?? '');
      setGroupId(groupIdValue ?? '');
      setPendingCount(groupIdValue !== savedGroup ? await import('../db/repositories/syncStateRepository').then(({ countDirtyRows }) => countDirtyRows()) : dirty);
      if (groupIdValue) {
        const loadedMembers = await loadFamilyGroupMembers();
        setMembers(loadedMembers);
        setMemberLoadError(false);
      } else {
        setMembers([]);
      }
      setError('');
    } catch {
      setMemberLoadError(true);
    }
  }, [setLastSyncedAt]);

  useEffect(() => {
    if (!cloudEnabled) return;
    void Promise.resolve().then(() => load());
    return subscribeToAuthChanges((_event, currentSession) => {
      setTimeout(() => {
        void load(currentSession).then(() => currentSession ? syncNow() : undefined);
      }, 0);
    });
  }, [load]);

  const messageForError = (value: unknown) => {
    const raw = value instanceof Error ? value.message : '';
    if (raw.includes('invalid_or_expired_code')) return t('settings.invalidOrExpiredCode');
    if (raw.includes('leave_current_group_first')) return t('settings.leaveCurrentFirst');
    if (raw.includes('only_owner_can_invite')) return t('settings.onlyOwnerInvite');
    if (raw.includes('last_member_cannot_leave')) return t('settings.lastMemberLeave');
    if (raw.includes('cloud_unavailable')) return t('settings.cloudUnavailable');
    return t('settings.groupError');
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); }
    catch (cause) { setError(messageForError(cause)); }
    finally { setBusy(false); }
  };

  const handleSendCode = () => run(async () => {
    await sendCode(email);
    setSentCode(true);
    setMessage(t('settings.codeSent'));
  });

  const handleVerify = () => run(async () => {
    await verifyCode(email, code);
    const next = await getCurrentSession();
    await load(next);
    await syncNow();
  });

  const saveName = () => run(async () => {
    if (!nameInput.trim()) { setError(t('settings.nameRequired')); return; }
    if (groupId) await updateMyDisplayName(nameInput.trim());
    else await setSyncValue('displayName', nameInput.trim());
    setDisplayName(nameInput.trim());
    setEditingName(false);
    await load(session);
  });

  const startGroup = () => run(async () => {
    await startFamilyGroup(displayName);
    await load(session);
    await syncNow();
  });

  const joinGroup = () => {
    Alert.alert(t('settings.joinWithCode'), t('settings.joinWarning'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.join'), onPress: () => { void run(async () => {
        await joinFamilyGroup(code, displayName);
        setJoining(false);
        setCode('');
        await load(session);
        await syncNow();
      }); } },
    ]);
  };

  const makeInvite = () => run(async () => {
    setInviteCode(await createFamilyInvite());
  });

  const shareInvite = async () => {
    if (!inviteCode) return;
    try { await Share.share({ message: t('settings.inviteMessage', { code: inviteCode }) }); }
    catch { setError(t('settings.groupError')); }
  };

  const performLeave = async () => {
    const invitations = await listInvitations();
    await Promise.all(invitations.map((invitation) => cancelInvitationReminders(invitation.notificationIds)));
    await leaveFamilyGroup();
    await clearNotebook();
    setInviteCode('');
    await load(session);
    navigation.goBack();
  };

  const switchAccount = (includeBackup: boolean) => run(async () => {
    if (includeBackup) await exportBackupToShare();
    const invitations = await listInvitations();
    await Promise.all(invitations.map((invitation) => cancelInvitationReminders(invitation.notificationIds)));
    await clearNotebook();
    await resetPullCursors();
    if (session) await setSyncValue('accountUserId', session.user.id);
    await load(session);
  });

  const removeCloudAccount = (eraseLocal: boolean) => run(async () => {
    const invitations = eraseLocal ? await listInvitations() : [];
    await deleteCloudAccount();
    if (eraseLocal) {
      await Promise.all(invitations.map((invitation) => cancelInvitationReminders(invitation.notificationIds)));
      await clearNotebook();
    } else {
      await deleteSyncValues(['accountUserId', 'cloudHouseholdId', 'memberCount', 'lastSyncedAt', 'displayName']);
      await resetPullCursors();
    }
    setSession(null);
    setGroupId('');
    setMembers([]);
    if (!eraseLocal) setMessage(t('settings.accountDeletedLocalKept'));
  });

  const leave = () => Alert.alert(t('settings.leaveGroup'), t('settings.leaveConfirm'), [
    { text: t('settings.cancel'), style: 'cancel' },
    { text: t('settings.backupBeforeLeave'), onPress: () => { void run(async () => { await exportBackupToShare(); await performLeave(); }); } },
    { text: t('settings.leaveGroup'), style: 'destructive', onPress: () => { void run(performLeave); } },
  ]);

  const owner = members.some((member) => member.user_id === session?.user.id && member.role === 'owner');
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
  const openPrivacy = async () => {
    if (!privacyUrl) return;
    try { await Linking.openURL(privacyUrl); }
    catch { setError(t('settings.groupError')); }
  };

  return (
    <ScreenLayout title={t('settings.familySettings')}>
      {!cloudEnabled ? <InlineNotice>{t('settings.cloudUnavailable')}</InlineNotice> : null}
      <AppText>{t('settings.cloudIntro')}</AppText>
      {message ? <InlineNotice>{message}</InlineNotice> : null}
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

      {accountChanged && <Surface style={styles.form}>
        <InlineNotice tone="warning">{t('settings.accountChangedWarning')}</InlineNotice>
        <ActionButton title={t('settings.backupThenSwitch')} accessibilityLabel={t('settings.backupThenSwitch')} busy={busy} onPress={() => void switchAccount(true)} />
        <ActionButton title={t('settings.switchAndClear')} accessibilityLabel={t('settings.switchAndClear')} variant="danger" disabled={busy} onPress={() => Alert.alert(t('settings.switchAccount'), t('settings.switchAccountConfirm'), [
          { text: t('settings.cancel'), style: 'cancel' },
          { text: t('settings.switchAndClear'), style: 'destructive', onPress: () => { void switchAccount(false); } },
        ])} />
      </Surface>}

      {!cloudEnabled || accountChanged ? null : !session ? <Surface style={styles.form}>
        <TextField label={t('settings.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {sentCode ? <TextField label={t('settings.code')} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} /> : null}
        <ActionButton title={t(sentCode ? 'settings.verifyCode' : 'settings.sendCode')} accessibilityLabel={t(sentCode ? 'settings.verifyCode' : 'settings.sendCode')} busy={busy} onPress={() => void (sentCode ? handleVerify() : handleSendCode())} />
        {privacyUrl ? <ActionButton title={t('settings.openPrivacy')} accessibilityLabel={t('settings.openPrivacy')} variant="quiet" onPress={() => void openPrivacy()} /> : <AppText style={styles.muted}>{t('settings.privacyNotAvailable')}</AppText>}
      </Surface> : <>
        <AppText weight="medium">{t('settings.signedInAs', { email: session.user.email ?? '' })}</AppText>
        {!displayName || editingName ? <Surface style={styles.form}>
          <TextField label={t('settings.displayName')} value={nameInput} onChangeText={setNameInput} placeholder={t('settings.displayNameExample')} autoCapitalize="words" />
          <ActionButton title={t('settings.saveName')} accessibilityLabel={t('settings.saveName')} busy={busy} onPress={() => void saveName()} />
          {editingName && <ActionButton title={t('settings.cancel')} accessibilityLabel={t('settings.cancel')} variant="quiet" onPress={() => setEditingName(false)} />}
        </Surface> : !groupId ? <>
          <AppText>{t('settings.noGroup')}</AppText>
          <ActionButton title={t('settings.startGroup')} accessibilityLabel={t('settings.startGroup')} icon={UserPlus} busy={busy} onPress={() => void startGroup()} />
          <ActionButton title={t('settings.joinWithCode')} accessibilityLabel={t('settings.joinWithCode')} variant="secondary" onPress={() => setJoining(true)} />
          {joining && <Surface style={styles.form}>
            <TextField label={t('settings.code')} value={code} onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} autoCapitalize="characters" maxLength={10} />
            <ActionButton title={t('settings.join')} accessibilityLabel={t('settings.join')} busy={busy} onPress={joinGroup} />
          </Surface>}
        </> : <>
          <SectionHeading title={t('settings.groupMembers')} />
          {memberLoadError && <InlineNotice tone="warning">{t('settings.groupError')}</InlineNotice>}
          {members.map((member, index) => <View key={`${member.created_at}-${index}`} style={styles.memberRow}>
            <AppText weight="medium" style={styles.memberName}>{member.display_name || t('settings.memberNameMissing')}</AppText>
            {member.role === 'owner' && <AppText style={styles.owner}>{t('settings.owner')}</AppText>}
          </View>)}
          {owner && <View style={styles.groupActions}>
            <ActionButton title={t('settings.inviteSomeone')} accessibilityLabel={t('settings.inviteSomeone')} icon={UserPlus} busy={busy} onPress={() => void makeInvite()} />
            {inviteCode ? <Surface style={styles.inviteCard}>
              <AppText variant="heading" weight="bold" style={styles.inviteCode}>{inviteCode}</AppText>
              <AppText style={styles.muted}>{t('settings.inviteInfo')}</AppText>
              <ActionButton title={t('settings.shareCode')} accessibilityLabel={t('settings.shareCode')} icon={Share2} variant="secondary" onPress={() => void shareInvite()} />
            </Surface> : null}
          </View>}
          <ActionButton title={t('settings.changeName')} accessibilityLabel={t('settings.changeName')} variant="secondary" onPress={() => { setEditingName(true); setNameInput(displayName); }} />
          <SectionHeading title={t('settings.syncStatus')} />
          <AppText>{t('settings.pendingChanges', { count: pendingCount })}</AppText>
          <AppText>{t(syncStatus === 'syncing' ? 'settings.syncing' : syncStatus === 'offline' ? 'settings.offline' : syncStatus === 'error' ? 'settings.syncError' : 'settings.syncUpToDate')}</AppText>
          {lastSyncedAt ? <AppText style={styles.muted}>{t('settings.lastSynced', { time: new Date(lastSyncedAt).toLocaleString() })}</AppText> : null}
          <ActionButton title={t('settings.syncNow')} accessibilityLabel={t('settings.syncNow')} variant="secondary" busy={busy} onPress={() => void run(async () => { await syncNow(); await load(session); const status = useSyncStore.getState().status; setMessage(t(status === 'error' ? 'settings.syncError' : status === 'offline' ? 'settings.offline' : 'settings.syncComplete')); })} />
          <ActionButton title={t('settings.leaveGroup')} accessibilityLabel={t('settings.leaveGroup')} variant="danger" onPress={leave} />
        </>}
        <ActionButton title={t('settings.signOut')} accessibilityLabel={t('settings.signOut')} variant="quiet" disabled={busy} onPress={() => Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
          { text: t('settings.cancel'), style: 'cancel' },
          { text: t('settings.signOut'), style: 'destructive', onPress: () => { void run(async () => { await signOut(); setSession(null); }); } },
        ])} />
        <ActionButton title={t('settings.deleteAccount')} accessibilityLabel={t('settings.deleteAccount')} variant="quiet" disabled={busy} onPress={() => Alert.alert(t('settings.deleteAccount'), t('settings.deleteCloudConfirmFirst'), [
          { text: t('settings.cancel'), style: 'cancel' },
          { text: t('settings.deleteAccount'), style: 'destructive', onPress: () => Alert.alert(t('settings.deleteAccount'), t('settings.deleteCloudConfirmSecond'), [
            { text: t('settings.cancel'), style: 'cancel' },
            { text: t('settings.deleteAccount'), style: 'destructive', onPress: () => { void removeCloudAccount(false); } },
            { text: t('settings.erasePhoneData'), style: 'destructive', onPress: () => { void removeCloudAccount(true); } },
          ]) },
        ])} />
      </>}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  muted: { color: colors.muted },
  memberRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: spacing.xs },
  memberName: { flex: 1 },
  owner: { backgroundColor: colors.primaryWash, borderRadius: 8, color: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  groupActions: { gap: spacing.sm },
  inviteCard: { alignItems: 'center', gap: spacing.sm },
  inviteCode: { color: colors.primary, textAlign: 'center' },
});
