import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (value: string | null) => void;
  setPendingCount: (value: number) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  setStatus: (status) => set({ status }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
