import { create } from 'zustand';

type SecurityState = {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
};

export const useSecurityStore = create<SecurityState>((set) => ({
  locked: false,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));
