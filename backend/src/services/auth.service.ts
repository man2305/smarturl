import { Types } from 'mongoose';
import { userRepository } from '../repositories/user.repository';
import { RefreshTokenModel } from '../models/RefreshToken.model';
import { ApiError } from '../utils/ApiError';
import { serializeUser, type PublicUser } from '../utils/serializers';
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

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

async function issueTokens(userId: string): Promise<AuthTokens> {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  await RefreshTokenModel.create({
    token: hashToken(refreshToken),
    userId: new Types.ObjectId(userId),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      password: input.password,
    });

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

  /** Refresh-token rotation: old token is revoked, a new pair is issued. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token required');

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const stored = await RefreshTokenModel.findOne({ token: hashToken(refreshToken) });
    if (!stored) throw ApiError.unauthorized('Invalid refresh token');
    if (stored.expiresAt.getTime() < Date.now()) throw ApiError.unauthorized('Refresh token expired');

    const user = await userRepository.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Account no longer exists');

    await RefreshTokenModel.deleteOne({ _id: stored._id });
    const tokens = await issueTokens(user.id);
    return { user: toPublicUser(user), tokens };
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
