import { Router, Request, Response } from 'express';
import { adminAuthMiddleware } from '../middleware/authMiddleware';
import { analyticsService } from '../analytics/AnalyticsService';

const router = Router();

router.use(adminAuthMiddleware);

/** GET /api/analytics/:siteId */
router.get('/:siteId', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { since } = req.query as { since?: string };

  const sinceDate = since ? new Date(since) : undefined;
  const summary = await analyticsService.getSummary(siteId, sinceDate);
  res.json(summary);
});

export default router;
