import { describe, expect, it } from '@jest/globals';

import { getAccountTransition } from './accountRules';

describe('account transition rules', () => {
  it('identifies first sync, the same account, and a different account', () => {
    expect(getAccountTransition(null, 'account-a')).toBe('first-sync');
    expect(getAccountTransition('account-a', 'account-a')).toBe('same-account');
    expect(getAccountTransition('account-a', 'account-b')).toBe('different-account');
  });
});
