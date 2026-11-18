import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { userRepository } from '../repositories/user.repository';
import { RefreshTokenModel } from '../models/RefreshToken.model';
import { ApiError } from '../utils/ApiError';
import { serializeUser, type PublicUser } from '../utils/serializers';
import { REFRESH_REUSE_GRACE_MS } from '../config/constants';
import { env } from '../config/env';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from './token.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface PublicUserLike {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  isEmailVerified: boolean;
  createdAt?: Date;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

const toPublicUser = (u: PublicUserLike): PublicUser =>
  serializeUser({
    _id: u.id ?? u._id ?? '',
    name: u.name,
    email: u.email,
    isEmailVerified: u.isEmailVerified,
    createdAt: u.createdAt,
  });

async function issueTokens(userId: string, family?: string): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  await RefreshTokenModel.create({
    token: hashToken(refreshToken),
    userId: new Types.ObjectId(userId),
    expiresAt: new Date(Date.now() + env.jwt.refreshTtlMs),
    family: family ?? crypto.randomUUID(),
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('An account with this email already exists');

    let user;
    try {
      user = await userRepository.create({
        name: input.name,
        email: input.email,
        password: input.password,
      });
    } catch (err) {
      // Unique-index violation = a concurrent registration won the race.
      if ((err as { code?: number })?.code === 11000) {
        throw ApiError.conflict('An account with this email already exists');
      }
      throw err;
    }

    const tokens = await issueTokens(user.id);
    return { user: toPublicUser(user), tokens };
  },

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await userRepository.findByEmailWithPassword(input.email);
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    const isValid = await user.comparePassword(input.password);
    if (!isValid) throw ApiError.unauthorized('Invalid email or password');

    const tokens = await issueTokens(user.id);
    return { user: toPublicUser(user), tokens };
  },

  /**
   * Refresh-token rotation, atomic: the presented token is claimed with a
   * single findOneAndUpdate that only matches unrotated tokens, so exactly
   * one of any concurrent refreshes with the same token succeeds. The
   * rotated token is kept (marked with rotatedAt) instead of deleted, which
   * makes reuse detectable: presenting it again after the grace window
   * revokes the whole token family (likely theft). A token that is simply
   * unknown (logged out, never issued) is rejected without revoking
   * anything, so a stale client cannot nuke unrelated sessions.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token required');

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const hashed = hashToken(refreshToken);
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { token: hashed, rotatedAt: null },
      { $set: { rotatedAt: new Date() } },
      { new: true }
    ).exec();

    if (claimed) {
      if (claimed.expiresAt.getTime() < Date.now()) {
        throw ApiError.unauthorized('Refresh token expired');
      }
      const user = await userRepository.findById(payload.sub);
      if (!user) throw ApiError.unauthorized('Account no longer exists');

      const tokens = await issueTokens(user.id, claimed.family ?? undefined);
      return { user: toPublicUser(user), tokens };
    }

    const existing = await RefreshTokenModel.findOne({ token: hashed }).exec();
    if (existing?.rotatedAt) {
      const ageMs = Date.now() - existing.rotatedAt.getTime();
      if (ageMs > REFRESH_REUSE_GRACE_MS && existing.family) {
        await RefreshTokenModel.deleteMany({ family: existing.family }).exec();
      }
      throw ApiError.unauthorized('Refresh token reuse detected');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  },

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    await RefreshTokenModel.deleteOne({ token: hashToken(refreshToken) });
  },

  async getMe(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return toPublicUser(user);
  },
};
