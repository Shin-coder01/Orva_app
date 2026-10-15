import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
let queuedInvitationId: string | null = null;

export function openInvitationPrompt(invitationId: string): void {
  if (navigationRef.isReady()) navigationRef.navigate('InvitationPrompt', { invitationId });
  else queuedInvitationId = invitationId;
}

export function flushQueuedNavigation(): void {
  if (!queuedInvitationId || !navigationRef.isReady()) return;
  navigationRef.navigate('InvitationPrompt', { invitationId: queuedInvitationId });
  queuedInvitationId = null;
}
