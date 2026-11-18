import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });
  // Mid-run drops are otherwise silent until requests start timing out.
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[db] reconnected');
  });

  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  if (env.nodeEnv !== 'production') {
    console.log(`[db] connected at ${mongoose.connection.host}/${mongoose.connection.name}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
