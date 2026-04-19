import { Router, Request, Response } from 'express';
import { adminAuthMiddleware } from '../middleware/authMiddleware';
import { getRAGPipeline } from '../rag/RAGPipeline';
import { IngestionConfig, IngestionSource } from '../rag/types';
import { logger } from '../utils/logger';

const router = Router();

// All knowledge routes require admin auth
router.use(adminAuthMiddleware);

/**
 * POST /api/kb/:siteId/ingest
 * Run full ingestion from ingestion.json (or fall back to knowledge/ dir scan).
 */
router.post('/:siteId/ingest', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  try {
    const rag = getRAGPipeline(siteId);
    const result = await rag.ingest();
    res.json(result);
  } catch (err) {
    logger.error(`[KB] Ingest error for ${siteId}:`, err);
    res.status(500).json({ error: 'Ingestion failed', details: String(err) });
  }
});

/**
 * POST /api/kb/:siteId/reindex
 * Clear the entire vector store and re-ingest from scratch.
 */
router.post('/:siteId/reindex', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  try {
    logger.info(`[KB] Re-indexing ${siteId}...`);
    const rag = getRAGPipeline(siteId);
    const result = await rag.reindex();
    res.json(result);
  } catch (err) {
    logger.error(`[KB] Re-index error for ${siteId}:`, err);
    res.status(500).json({ error: 'Re-index failed', details: String(err) });
  }
});

/**
 * POST /api/kb/:siteId/ingest-url
 * Crawl and ingest a specific URL (BFS).
 */
router.post('/:siteId/ingest-url', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { url, maxPages, allowedPaths } = req.body as {
    url: string;
    maxPages?: number;
    allowedPaths?: string[];
  };

  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const rag = getRAGPipeline(siteId);
    const result = await rag.ingestFromUrl(url, maxPages, allowedPaths);
    res.json(result);
  } catch (err) {
    logger.error(`[KB] URL ingest error for ${siteId}:`, err);
    res.status(500).json({ error: 'Ingestion failed', details: String(err) });
  }
});

/**
 * POST /api/kb/:siteId/ingest-sitemap
 * Parse a sitemap.xml and ingest all matching URLs.
 */
router.post('/:siteId/ingest-sitemap', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { url, maxPages, allowedPaths } = req.body as {
    url: string;
    maxPages?: number;
    allowedPaths?: string[];
  };

  if (!url) return res.status(400).json({ error: 'Sitemap url is required' });

  try {
    const rag = getRAGPipeline(siteId);
    const result = await rag.ingestFromSitemap(url, maxPages, allowedPaths);
    res.json(result);
  } catch (err) {
    logger.error(`[KB] Sitemap ingest error for ${siteId}:`, err);
    res.status(500).json({ error: 'Sitemap ingestion failed', details: String(err) });
  }
});

/**
 * POST /api/kb/:siteId/ingest-text
 * Directly ingest raw text content.
 */
router.post('/:siteId/ingest-text', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { text, source = 'manual-input' } = req.body as { text: string; source?: string };

  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const rag = getRAGPipeline(siteId);
    const result = await rag.ingestText(text, source);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ingestion failed', details: String(err) });
  }
});

/**
 * DELETE /api/kb/:siteId/source
 * Remove all vectors for a specific source.
 * Body: { source: string }
 */
router.delete('/:siteId/source', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { source } = req.body as { source: string };

  if (!source) return res.status(400).json({ error: 'source is required' });

  try {
    const rag = getRAGPipeline(siteId);
    const removed = await rag.removeSource(source);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: 'Remove failed', details: String(err) });
  }
});

/**
 * DELETE /api/kb/:siteId
 * Clear the entire knowledge base.
 */
router.delete('/:siteId', async (req: Request, res: Response) => {
  try {
    const rag = getRAGPipeline(req.params.siteId);
    await rag.clearKnowledgeBase();
    res.json({ success: true, message: 'Knowledge base cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Clear failed', details: String(err) });
  }
});

/**
 * GET /api/kb/:siteId/stats
 * Returns doc count, per-source breakdown, and current ingestion config.
 */
router.get('/:siteId/stats', async (req: Request, res: Response) => {
  try {
    const rag = getRAGPipeline(req.params.siteId);
    const stats = await rag.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Stats failed', details: String(err) });
  }
});

/**
 * GET /api/kb/:siteId/config
 * Get the tenant's ingestion.json config.
 */
router.get('/:siteId/config', async (req: Request, res: Response) => {
  const rag = getRAGPipeline(req.params.siteId);
  const config = rag.loadIngestionConfig();
  if (!config) return res.status(404).json({ error: 'No ingestion config found' });
  res.json(config);
});

/**
 * PUT /api/kb/:siteId/config
 * Save a new ingestion.json config and optionally trigger re-ingestion.
 * Body: IngestionConfig + optional { runNow: boolean }
 */
router.put('/:siteId/config', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { runNow, ...config } = req.body as IngestionConfig & { runNow?: boolean };

  try {
    const rag = getRAGPipeline(siteId);
    rag.saveIngestionConfig(config as IngestionConfig);
    logger.info(`[KB] Saved ingestion config for ${siteId}`);

    if (runNow) {
      // Fire-and-forget the ingest; return immediately
      rag.ingest().catch((e) => logger.error(`[KB] Background ingest error:`, e));
      return res.json({ success: true, message: 'Config saved and ingestion started' });
    }

    res.json({ success: true, message: 'Config saved' });
  } catch (err) {
    res.status(500).json({ error: 'Save failed', details: String(err) });
  }
});

/**
 * POST /api/kb/:siteId/search (debug — test retrieval directly)
 */
router.post('/:siteId/search', async (req: Request, res: Response) => {
  const { siteId } = req.params;
  const { query, topK = 5, minScore = 0.2 } = req.body as {
    query: string;
    topK?: number;
    minScore?: number;
  };

  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const rag = getRAGPipeline(siteId);
    const { getVectorStore } = await import('../rag/VectorStore');
    const store = getVectorStore(siteId);
    const results = await store.search(query, topK, minScore);
    res.json({ query, results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: String(err) });
  }
});

export default router;
