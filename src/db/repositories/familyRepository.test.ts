import { describe, expect, it } from '@jest/globals';

import { normalizeFamilyName } from './familyRepository';

describe('family name normalization', () => {
  it('ignores case, extra spaces, and the trailing family word', () => {
    expect(normalizeFamilyName('  RAVI   FAMILY ')).toBe('ravi');
    expect(normalizeFamilyName('Ravi')).toBe('ravi');
  });

  it('ignores a trailing Tamil family word', () => {
    expect(normalizeFamilyName('ரவி குடும்பம்')).toBe('ரவி');
  });
});
