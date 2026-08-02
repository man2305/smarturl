import { Schema, model, type Document } from 'mongoose';
import type { Types } from 'mongoose';

export interface IRefreshToken {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
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
});

/**
 * Indexes:
 * - { token: 1 } unique -> token rotation lookup.
 * - { expiresAt: 1 } TTL -> MongoDB automatically deletes expired
 *   refresh tokens (cleanup without a cron job).
 */
refreshTokenSchema.index({ token: 1 }, { unique: true });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshTokenDoc>('RefreshToken', refreshTokenSchema);
