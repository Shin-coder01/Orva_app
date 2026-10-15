export type AccountTransition = 'first-sync' | 'same-account' | 'different-account';

export function getAccountTransition(previousUserId: string | null, currentUserId: string): AccountTransition {
  if (!previousUserId) return 'first-sync';
  return previousUserId === currentUserId ? 'same-account' : 'different-account';
}
