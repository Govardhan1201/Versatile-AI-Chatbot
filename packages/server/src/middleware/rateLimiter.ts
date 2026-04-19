import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { TenantConfig } from '@versatile-ai-bot/shared';
import { env } from '../config/env';

type TenantRequest = Request & { tenant?: TenantConfig };

/** Dynamic rate limiter that respects per-tenant limits */
export function createRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req: TenantRequest) => {
      return req.tenant?.rateLimit?.requestsPerMinute ?? env.defaultRateLimit;
    },
    keyGenerator: (req: TenantRequest) => {
      // Rate limit per IP + siteId combination
      const ip = req.ip ?? '0.0.0.0';
      const siteId = req.params.siteId ?? 'global';
      return `${ip}:${siteId}`;
    },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment.',
        retryAfter: 60,
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
