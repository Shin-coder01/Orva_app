let syncTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    void import('./syncService').then(({ syncNow }) => syncNow());
  }, 3000);
}
