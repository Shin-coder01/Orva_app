import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n from '../i18n';
import type { AppLanguage } from '../i18n/types';

type SettingsState = {
  language: AppLanguage | null;
  hasHydrated: boolean;
  setLanguage: (language: AppLanguage) => void;
  finishHydration: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      hasHydrated: false,
      setLanguage: (language) => {
        void i18n.changeLanguage(language);
        set({ language });
      },
      finishHydration: () => set({ hasHydrated: true }),
    }),
    {
      name: 'orva-settings',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          void i18n.changeLanguage(state.language);
        }
        state?.finishHydration();
      },
    },
  ),
);
