import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import apiRoutes from './routes';
import redirectRoutes from './routes/redirect.routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimiter';
import { env } from './config/env';

export function createApp(): express.Express {
  const app = express();

  // Behind Render/Vercel proxies, trust the first hop so rate limiting and
  // client-IP detection see real IPs.
  app.set('trust proxy', 1);

  app.use(helmet());

  // CORS with credentials for the httpOnly refresh-token cookie.
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Neutralize MongoDB query operator injection ($, $gt, ...) in body/query/params.
  app.use(mongoSanitize());

  app.use(compression());

  if (env.nodeEnv !== 'test') {
    // Log paths without query strings: search terms and other user input
    // in query params must not land in production access logs.
    morgan.token('url', (req) => (req.url ?? '').split('?')[0]);
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api', apiLimiter, apiRoutes);

  // Unmatched /api/* paths are 404s, not short codes — without this they
  // fall through to the redirect router and cost a DB lookup per request.
  app.use('/api', notFoundHandler);

  // Must be registered after /api so /api/* is never treated as a short code.
  app.use(redirectRoutes);

  // Error handlers must be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
