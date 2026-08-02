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
    expiresIn: env.jwt.accessExpiresIn as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ type: 'refresh' }, env.jwt.refreshSecret, {
    ...signOptions(),
    subject: userId,
    expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  });
}

/** Throws on invalid/expired tokens — callers convert to 401. */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwt.accessSecret, verifyOptions());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as unknown as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwt.refreshSecret, verifyOptions());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as unknown as TokenPayload;
}

/**
 * Hash refresh tokens before persisting so a DB leak doesn't expose
 * usable tokens (defence-in-depth alongside the JWT signature).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
