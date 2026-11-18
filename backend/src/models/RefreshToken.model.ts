import { Schema, model, type Document } from 'mongoose';
import type { Types } from 'mongoose';

export interface IRefreshToken {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  /** Rotation lineage: every token issued from one login shares a family. */
  family?: string;
  /** Set when this token has been rotated; a rotated token must never refresh again. */
  rotatedAt?: Date | null;
}

export interface IRefreshTokenDoc extends IRefreshToken, Document {}

const refreshTokenSchema = new Schema<IRefreshTokenDoc>({
  token: {
    type: String,
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  family: {
    type: String,
  },
  rotatedAt: {
    type: Date,
    default: null,
  },
});

/**
 * Indexes:
 * - { token: 1 } unique -> token rotation lookup.
 * - { expiresAt: 1 } TTL -> MongoDB automatically deletes expired
 *   refresh tokens (cleanup without a cron job).
 * - { family: 1 } -> revoke a whole token family on reuse detection.
 * - { userId: 1 } -> revoke all of a user's sessions.
 */
refreshTokenSchema.index({ token: 1 }, { unique: true });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ family: 1 });
refreshTokenSchema.index({ userId: 1 });

export const RefreshTokenModel = model<IRefreshTokenDoc>('RefreshToken', refreshTokenSchema);
