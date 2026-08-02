import crypto from 'node:crypto';
import { SHORT_CODE_LENGTH } from '../config/constants';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHABET_LENGTH = ALPHABET.length;

/** Encode a positive integer into a Base62 string (used for reversible codes if needed). */
export function encodeBase62(num: number): string {
  let n = num;
  let out = '';
  do {
    out = ALPHABET[n % ALPHABET_LENGTH] + out;
    n = Math.floor(n / ALPHABET_LENGTH);
  } while (n > 0);
  return out;
}

/**
 * Generate a cryptographically-random short code.
 * Using random bytes keeps slugs unguessable (no sequential enumeration),
 * which is important when short links can leak to unauthorized users.
 */
export function generateShortCode(length: number = SHORT_CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET_LENGTH];
  }
  return code;
}
