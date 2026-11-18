import net from 'node:net';
import type { Request } from 'express';

/**
 * Resolve the real client IP behind the proxy (Render/Vercel, nginx).
 * Uses req.ip, which Express derives from X-Forwarded-For using the
 * configured trust proxy depth — the leftmost X-Forwarded-For entry must
 * NOT be trusted directly, because any client can prepend a fake address
 * and pollute analytics or mint unlimited "unique visitors".
 */
export function getClientIp(req: Request): string {
  const candidate = req.ip || req.socket.remoteAddress || '';
  return net.isIP(candidate) ? candidate : '';
}
