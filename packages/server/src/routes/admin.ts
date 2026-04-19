import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateAdminToken, adminAuthMiddleware } from '../middleware/authMiddleware';
import { tenantManager } from '../tenants/TenantManager';
import { TenantConfigSchema } from '@versatile-ai-bot/shared';
import { storage } from '../storage/StorageAdapter';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();

/** POST /api/admin/login */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Simple credential check (production: hash in DB)
  const validUsername = username === env.adminUsername;
  const validPassword = password === env.adminPassword;

  if (!validUsername || !validPassword) {
    logger.warn(`Failed admin login attempt for username: ${username}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateAdminToken(username);
  res.json({ token, username, expiresIn: env.adminSessionExpiry });
});

// All routes below require auth
router.use(adminAuthMiddleware);

/** GET /api/admin/tenants — list all tenants */
router.get('/tenants', async (_req: Request, res: Response) => {
  const ids = await tenantManager.listTenants();
  const tenants = await Promise.all(ids.map((id) => tenantManager.getTenant(id)));
  res.json(tenants.filter(Boolean));
});

/** GET /api/admin/tenants/:siteId */
router.get('/tenants/:siteId', async (req: Request, res: Response) => {
  const config = await tenantManager.getTenant(req.params.siteId);
  if (!config) return res.status(404).json({ error: 'Tenant not found' });
  res.json(config);
});

/** POST /api/admin/tenants — create new tenant */
router.post('/tenants', async (req: Request, res: Response) => {
  try {
    const config = TenantConfigSchema.parse({
      ...req.body,
      createdAt: new Date().toISOString(),
    });

    const existing = await tenantManager.getTenant(config.siteId);
    if (existing) {
      return res.status(409).json({ error: `Tenant ${config.siteId} already exists` });
    }

    await tenantManager.saveTenant(config);
    res.status(201).json(config);
  } catch (err) {
    res.status(400).json({ error: 'Invalid tenant config', details: String(err) });
  }
});

/** PUT /api/admin/tenants/:siteId — update tenant */
router.put('/tenants/:siteId', async (req: Request, res: Response) => {
  try {
    const existing = await tenantManager.getTenant(req.params.siteId);
    if (!existing) return res.status(404).json({ error: 'Tenant not found' });

    const config = TenantConfigSchema.parse({ ...existing, ...req.body, siteId: req.params.siteId });
    await tenantManager.saveTenant(config);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: 'Invalid config', details: String(err) });
  }
});

/** DELETE /api/admin/tenants/:siteId */
router.delete('/tenants/:siteId', async (req: Request, res: Response) => {
  const deleted = await tenantManager.deleteTenant(req.params.siteId);
  if (!deleted) return res.status(404).json({ error: 'Tenant not found' });
  res.json({ success: true });
});

/** GET /api/admin/tenants/:siteId/logs — conversation logs */
router.get('/tenants/:siteId/logs', async (req: Request, res: Response) => {
  const logs = await storage.readAll('logs', req.params.siteId);
  const page = parseInt(req.query.page as string ?? '1', 10);
  const limit = parseInt(req.query.limit as string ?? '50', 10);
  const start = (page - 1) * limit;
  res.json({
    total: logs.length,
    page,
    limit,
    data: logs.slice(start, start + limit).reverse(), // newest first
  });
});

/** GET /api/admin/analytics/:siteId */
router.get('/analytics/:siteId', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  try {
    const { analyticsService } = await import('../analytics/AnalyticsService');
    const summary = await analyticsService.getSummary(siteId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Analytics fetch failed', details: String(err) });
  }
});

export default router;
