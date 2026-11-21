import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { startExpirySweeper } from './services/expirySweeper';

// Last-resort guards: without these, an unhandled rejection or exception
// crashes the process with no log line at all. Fail fast — the process
// manager (Render) restarts a clean process.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception', err);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await connectRedis();
  startExpirySweeper();

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    console.log(`[server] SmartURL API listening on ${env.baseUrl} (${env.nodeEnv})`);
  });

  // listen() errors (e.g. EADDRINUSE) are not catchable via bootstrap().
  server.on('error', (err) => {
    console.error('[server] failed to listen', err);
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      try {
        await disconnectDatabase();
        await disconnectRedis();
      } catch (err) {
        console.error('[server] error during shutdown', err);
      }
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
