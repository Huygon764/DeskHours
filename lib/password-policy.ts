import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';

let configured = false;
function configure(): void {
  if (configured) return;
  zxcvbnOptions.setOptions({
    translations: en.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...en.dictionary },
  });
  configured = true;
}

export interface PolicyResult {
  ok: boolean;
  errors: string[];
  /** zxcvbn score 0-4, exposed for a UI strength meter. */
  score: number;
}

const MIN_LENGTH = 12;
const MIN_SCORE = 3;

export function checkPassword(password: string): PolicyResult {
  configure();
  const errors: string[] = [];
  if (password.length < MIN_LENGTH) errors.push('Must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Must include an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Must include a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Must include a digit');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Must include a symbol');

  const { score, feedback } = zxcvbn(password);
  if (score < MIN_SCORE) {
    const hint = feedback.warning || feedback.suggestions[0] || 'too guessable';
    errors.push(`Password is too weak: ${hint}`);
  }
  return { ok: errors.length === 0, errors, score };
}
