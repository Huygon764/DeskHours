import { describe, it, expect } from 'vitest';
import { checkPassword } from './password-policy';

describe('checkPassword', () => {
  it('rejects short passwords', () => {
    const r = checkPassword('Ab1!');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('Must be at least 12 characters');
  });
  it('rejects missing character classes', () => {
    const r = checkPassword('alllowercaseletters');
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        'Must include an uppercase letter',
        'Must include a digit',
        'Must include a symbol',
      ]),
    );
  });
  it('rejects a guessable password even if it meets char rules', () => {
    const r = checkPassword('Password1234!');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes('weak'))).toBe(true);
  });
  it('accepts a strong, long, varied password', () => {
    const r = checkPassword('vT7$mq!Lz29wPx');
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});
