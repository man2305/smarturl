import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

const signOptions = (): SignOptions => ({
  issuer: env.jwt.issuer,
  audience: env.jwt.audience,
});

const verifyOptions = (): jwt.VerifyOptions => ({
  issuer: env.jwt.issuer,
  audience: env.jwt.audience,
});

export function signAccessToken(userId: string): string {
  return jwt.sign({ type: 'access' }, env.jwt.accessSecret, {
    ...signOptions(),
    subject: userId,
    jwtid: crypto.randomUUID(),
    expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ type: 'refresh' }, env.jwt.refreshSecret, {
    ...signOptions(),
    subject: userId,
    // A unique id per token: without it, two tokens minted in the same
    // second for the same user are byte-identical and collide on the
    // unique token index when both are stored.
    jwtid: crypto.randomUUID(),
    expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  });
}

/** Throws on invalid/expired tokens — callers convert to 401. */
export function verifyAccessToken(token: string): TokenPayload {
  return verifyTypedToken(token, env.jwt.accessSecret, 'access');
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verifyTypedToken(token, env.jwt.refreshSecret, 'refresh');
}

function verifyTypedToken(
  token: string,
  secret: string,
  expectedType: TokenPayload['type']
): TokenPayload {
  const decoded = jwt.verify(token, secret, verifyOptions());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  const payload = decoded as unknown as TokenPayload;
  if (payload.type !== expectedType) throw new Error('Invalid token type');
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Invalid token subject');
  }
  return payload;
}

/**
 * Hash refresh tokens before persisting so a DB leak doesn't expose
 * usable tokens (defence-in-depth alongside the JWT signature).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
