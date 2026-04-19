import { Request, Response, NextFunction } from 'express';
import { tenantManager } from '../tenants/TenantManager';
import { logger } from '../utils/logger';

/** Validate that the request origin is in the tenant's allowed domains list */
export async function domainGuard(req: Request, res: Response, next: NextFunction) {
  const siteId = req.params.siteId;
  if (!siteId) return next();

  const origin = req.headers.origin ?? req.headers.referer ?? '';
  const config = await tenantManager.getTenant(siteId);

  if (!config) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  if (!config.active) {
    return res.status(403).json({ error: 'This chatbot is currently disabled' });
  }

  // Skip domain check in development or if origin is same-server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev || !origin) {
    (req as Request & { tenant: typeof config }).tenant = config;
    return next();
  }

  if (!tenantManager.isOriginAllowed(config, origin)) {
    logger.warn(`Domain blocked for ${siteId}: origin=${origin}`);
    return res.status(403).json({ error: 'Domain not authorized for this chatbot' });
  }

  (req as Request & { tenant: typeof config }).tenant = config;
  next();
}
