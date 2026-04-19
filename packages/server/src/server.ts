import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { logger } from './utils/logger';
import { registerAllTools } from './tools/registerTools';
import { getRAGPipeline } from './rag/RAGPipeline';
import { tenantManager } from './tenants/TenantManager';

// Routes
import chatRoute from './routes/chat';
import configRoute from './routes/config';
import knowledgeRoute from './routes/knowledge';
import analyticsRoute from './routes/analytics';
import adminRoute from './routes/admin';

const app = express();

// ─── Security Headers ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // widget.js needs to be embeddable
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.corsOrigins === '*' ? '*' : env.corsOrigins.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Site-Id'],
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────── 
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Static: serve built widget.js ───────────────────────────────────────────
const widgetDistPath = path.resolve(__dirname, '../../widget/dist');
if (fs.existsSync(widgetDistPath)) {
  app.use('/widget', express.static(widgetDistPath));
  logger.info('Serving widget from /widget');
}

// ─── Static: serve built admin dashboard ─────────────────────────────────────
const adminDistPath = path.resolve(__dirname, '../../admin/dist');
if (fs.existsSync(adminDistPath)) {
  app.use('/admin', express.static(adminDistPath));
  // Serve index.html for React Router's client-side routing
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminDistPath, 'index.html'));
  });
  logger.info('Serving admin dashboard from /admin');
}

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', provider: env.llmProvider, ts: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────── 
app.use('/api/config', configRoute);
app.use('/api/chat', chatRoute);
app.use('/api/kb', knowledgeRoute);
app.use('/api/analytics', analyticsRoute);
app.use('/api/admin', adminRoute);

// ─── Test Pages: serve example embed tests ──────────────────────────────────
app.get('/test/:siteId', (req, res) => {
  const siteId = req.params.siteId;
  const testPagePath = path.resolve(__dirname, `../../../examples/${siteId}/test-embed.html`);
  if (fs.existsSync(testPagePath)) {
    res.sendFile(testPagePath);
  } else {
    res.status(404).send('Test page not found for this siteId');
  }
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
async function start() {
  // Ensure data directories exist
  ['data', 'data/logs', 'data/vectors', 'data/analytics', 'data/leads'].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Register all tools
  registerAllTools();

  // Auto-ingest knowledge bases for all tenants on startup
  logger.info('Auto-ingesting knowledge bases...');
  const tenantIds = await tenantManager.listTenants();
  for (const siteId of tenantIds) {
    try {
      const rag = getRAGPipeline(siteId);
      const result = await rag.ingestFromDirectory();
      if (result.chunksAdded > 0) {
        logger.info(`Auto-ingested ${result.chunksAdded} chunks for tenant: ${siteId}`);
      }
    } catch (err) {
      logger.warn(`Auto-ingest skipped for ${siteId}:`, err);
    }
  }

  app.listen(env.port, () => {
    logger.info(`🚀 VERSATILE AI BOT backend running at http://localhost:${env.port}`);
    logger.info(`📋 Admin API: http://localhost:${env.port}/api/admin`);
    logger.info(`🤖 LLM Provider: ${env.llmProvider}`);
    logger.info(`🔍 Embeddings: ${env.embeddingsProvider}`);
    logger.info(`📁 Tenants dir: ${env.tenantsDir}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
