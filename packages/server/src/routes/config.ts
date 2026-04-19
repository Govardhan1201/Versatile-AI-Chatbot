import { Router, Request, Response } from 'express';
import { tenantManager } from '../tenants/TenantManager';

const router = Router();

/** GET /api/config/:siteId — widget fetches this on startup for branding/settings */
router.get('/:siteId', async (req: Request, res: Response) => {
  const config = await tenantManager.getTenant(req.params.siteId);

  if (!config) {
    return res.status(404).json({ error: 'Chatbot not found' });
  }

  if (!config.active) {
    return res.status(403).json({ error: 'Chatbot is disabled' });
  }

  // Only expose safe/public fields to the widget
  const publicConfig = {
    siteId: config.siteId,
    siteName: config.siteName,
    chatTitle: config.chatTitle ?? config.siteName,
    welcomeMessage: config.welcomeMessage,
    suggestedPrompts: config.suggestedPrompts,
    placeholderText: config.placeholderText,
    theme: config.theme,
    voice: { enabled: config.voice?.enabled ?? false },
    languages: config.languages,
    knowledgeEnabled: config.knowledgeBase?.enabled ?? false,
  };

  res.json(publicConfig);
});

export default router;
