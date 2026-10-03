import { describe, expect, it } from '@jest/globals';

import i18n from './index';
import en from './en.json';
import ta from './ta.json';

function leafPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix.length > 0 ? [prefix, key].join('.') : key;
    return typeof entry === 'string'
      ? [path]
      : leafPaths(entry as Record<string, unknown>, path);
  });
}

describe('translation resources', () => {
  it('provide the same translated keys in English and Tamil', () => {
    expect(leafPaths(ta).sort()).toEqual(leafPaths(en).sort());
  });

  it('include a first-launch language choice in both languages', () => {
    expect(en.language.title).toBe('Choose your language');
    expect(ta.language.title).toBe('உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்');
  });

  it('switches translations immediately without reinitializing', async () => {
    await i18n.changeLanguage('ta');
    expect(i18n.t('tabs.home')).toBe('முகப்பு');

    await i18n.changeLanguage('en');
    expect(i18n.t('tabs.home')).toBe('Home');
  });
});
