import type { AppLanguage } from '../i18n/types';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const families: Record<AppLanguage, Record<Weight, string>> = {
  en: {
    regular: 'NotoSans_400Regular',
    medium: 'NotoSans_500Medium',
    semibold: 'NotoSans_600SemiBold',
    bold: 'NotoSans_700Bold',
  },
  ta: {
    regular: 'NotoSansTamil_400Regular',
    medium: 'NotoSansTamil_500Medium',
    semibold: 'NotoSansTamil_600SemiBold',
    bold: 'NotoSansTamil_700Bold',
  },
};

export function fontFamily(language: AppLanguage, weight: Weight = 'regular') {
  return families[language][weight];
}

export const typeScale = {
  brand: { fontSize: 24, lineHeight: 36 },
  heading: { fontSize: 32, lineHeight: 44 },
  section: { fontSize: 20, lineHeight: 30 },
  body: { fontSize: 18, lineHeight: 29 },
  label: { fontSize: 18, lineHeight: 28 },
  tab: { fontSize: 13, lineHeight: 19 },
} as const;
