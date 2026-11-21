import crypto from 'node:crypto';
import { SHORT_CODE_LENGTH } from '../config/constants';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHABET_LENGTH = ALPHABET.length;

/**
 * Generate a cryptographically-random short code.
 * Using random bytes keeps slugs unguessable (no sequential enumeration),
 * which is important when short links can leak to unauthorized users.
 * Rejection sampling removes the modulo bias of `byte % 62` (256 is not
 * divisible by 62, so the first 8 alphabet chars would otherwise be ~25%
 * more likely than the rest).
 */
export function generateShortCode(length: number = SHORT_CODE_LENGTH): string {
  const limit = Math.floor(256 / ALPHABET_LENGTH) * ALPHABET_LENGTH;
  let code = '';
  while (code.length < length) {
    const bytes = crypto.randomBytes(length - code.length);
    for (const byte of bytes) {
      if (byte < limit) code += ALPHABET[byte % ALPHABET_LENGTH];
      if (code.length === length) break;
    }
  }
  return code;
}
