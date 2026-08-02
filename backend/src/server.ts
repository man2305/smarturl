import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { startExpirySweeper } from './services/expirySweeper';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  startExpirySweeper();

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    console.log(`[server] SmartURL API listening on ${env.baseUrl} (${env.nodeEnv})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
      process.exit(0);
    });
    // Hard-exit fallback if lingering connections refuse to close.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[server] fatal startup error', err);
  process.exit(1);
});
