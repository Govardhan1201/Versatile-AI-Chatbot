import fs from 'fs';
import path from 'path';
import { chunker } from './Chunker';
import { crawler } from './Crawler';
import { getVectorStore, evictVectorStore } from './VectorStore';
import {
  IngestResult,
  RAGContext,
  IngestionConfig,
  IngestionSource,
} from './types';
import { TenantConfig } from '@versatile-ai-bot/shared';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * RAGPipeline orchestrates:
 * - Knowledge ingestion from multiple source types (files, URLs, sitemaps, raw text)
 * - IngestionConfig file (ingestion.json) per tenant
 * - Retrieval with score-threshold and safe fallback messaging
 * - Re-index command (clear + full reingest)
 * - Stats and source listing
 */
export class RAGPipeline {
  private siteId: string;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  // ── Ingestion Orchestration ────────────────────────────────────────────────

  /**
   * Run ingestion from all sources defined in tenant's ingestion.json.
   * Falls back to plain directory scan if no ingestion.json exists.
   */
  async ingest(overrideConfig?: IngestionConfig): Promise<IngestResult> {
    const start = Date.now();
    const config = overrideConfig ?? this.loadIngestionConfig();

    if (!config || config.sources.length === 0) {
      logger.info(`[RAG:${this.siteId}] No ingestion config — scanning knowledge dir`);
      return this.ingestFromDirectory();
    }

    logger.info(`[RAG:${this.siteId}] Running ingestion: ${config.sources.length} sources`);

    const allErrors: IngestResult['errors'] = [];
    let totalChunks = 0;
    const allSources: string[] = [];

    for (const source of config.sources) {
      const result = await this.ingestSource(source);
      totalChunks += result.chunksAdded;
      allSources.push(...result.sourcesIngested);
      allErrors.push(...result.errors);
    }

    return {
      success: allErrors.length === 0,
      chunksAdded: totalChunks,
      sourcesIngested: allSources,
      errors: allErrors,
      durationMs: Date.now() - start,
    };
  }

  /** Ingest a single source entry */
  async ingestSource(source: IngestionSource): Promise<IngestResult> {
    const start = Date.now();

    switch (source.type) {
      case 'file':
        return this.ingestFromDirectory(undefined, source.pattern);

      case 'url':
        return this.ingestFromUrl(source.url, source.maxPages, source.allowedPaths);

      case 'sitemap':
        return this.ingestFromSitemap(source.url, source.maxPages, source.allowedPaths);

      case 'raw':
        return this.ingestText(source.text, source.source);

      default:
        return {
          success: false,
          chunksAdded: 0,
          sourcesIngested: [],
          errors: [{ source: 'unknown', message: `Unknown source type: ${(source as IngestionSource).type}` }],
          durationMs: Date.now() - start,
        };
    }
  }

  // ── File Ingestion ─────────────────────────────────────────────────────────

  async ingestFromDirectory(
    dirPath?: string,
    pattern?: string,
  ): Promise<IngestResult> {
    const start = Date.now();
    const knowledgeDir = dirPath ?? path.join(env.tenantsDir, this.siteId, 'knowledge');
    const errors: IngestResult['errors'] = [];
    const sourcesIngested: string[] = [];
    let totalChunks = 0;

    if (!fs.existsSync(knowledgeDir)) {
      return {
        success: false,
        chunksAdded: 0,
        sourcesIngested: [],
        errors: [{ source: knowledgeDir, message: 'Knowledge directory not found' }],
        durationMs: Date.now() - start,
      };
    }

    const allFiles = fs.readdirSync(knowledgeDir);
    const files = allFiles.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      if (!['.md', '.txt', '.json'].includes(ext)) return false;
      if (pattern) {
        // Simple glob: support *.ext and prefix* patterns
        const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        return new RegExp(`^${regexStr}$`, 'i').test(f);
      }
      return true;
    });

    const store = getVectorStore(this.siteId);

    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      const source = `knowledge/${file}`;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const ext = path.extname(file).toLowerCase();

        const chunks =
          ext === '.md'
            ? chunker.chunkMarkdown(content, source, 'file', {}, { filename: file })
            : ext === '.json'
            ? chunker.chunkJSON(content, source, 'file', { filename: file })
            : chunker.chunk(content, source, 'file', {}, { filename: file });

        await store.addChunks(chunks);
        sourcesIngested.push(source);
        totalChunks += chunks.length;
        logger.info(`[RAG:${this.siteId}] ✓ ${file} → ${chunks.length} chunks`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ source, message: msg });
        logger.error(`[RAG:${this.siteId}] ✗ ${file}: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      chunksAdded: totalChunks,
      sourcesIngested,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // ── URL Crawl Ingestion ────────────────────────────────────────────────────

  async ingestFromUrl(
    startUrl: string,
    maxPages = 20,
    allowedPaths?: string[],
  ): Promise<IngestResult> {
    const start = Date.now();
    const errors: IngestResult['errors'] = [];
    const sourcesIngested: string[] = [];
    let totalChunks = 0;

    try {
      const pages = await crawler.crawlSite(startUrl, maxPages, allowedPaths);
      const store = getVectorStore(this.siteId);

      for (const page of pages) {
        const combined =
          `# ${page.title}\n\n` +
          (page.description ? `${page.description}\n\n` : '') +
          page.content;

        const chunks = chunker.chunkMarkdown(combined, page.url, 'url', {}, {
          pageTitle: page.title,
          lang: page.lang ?? 'en',
          ...(page.headings?.length ? { headings: page.headings.join(', ') } : {}),
        });

        await store.addChunks(chunks);
        sourcesIngested.push(page.url);
        totalChunks += chunks.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ source: startUrl, message: `Crawl failed: ${msg}` });
    }

    return {
      success: errors.length === 0,
      chunksAdded: totalChunks,
      sourcesIngested,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // ── Sitemap Ingestion ──────────────────────────────────────────────────────

  async ingestFromSitemap(
    sitemapUrl: string,
    maxPages = 50,
    allowedPaths?: string[],
  ): Promise<IngestResult> {
    const start = Date.now();
    const errors: IngestResult['errors'] = [];
    const sourcesIngested: string[] = [];
    let totalChunks = 0;

    try {
      const pages = await crawler.crawlSitemap(sitemapUrl, maxPages, allowedPaths);
      const store = getVectorStore(this.siteId);

      for (const page of pages) {
        const combined =
          `# ${page.title}\n\n` +
          (page.description ? `${page.description}\n\n` : '') +
          page.content;

        const chunks = chunker.chunkMarkdown(combined, page.url, 'sitemap', {}, {
          pageTitle: page.title,
          lang: page.lang ?? 'en',
        });

        await store.addChunks(chunks);
        sourcesIngested.push(page.url);
        totalChunks += chunks.length;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ source: sitemapUrl, message: `Sitemap ingestion failed: ${msg}` });
    }

    return {
      success: errors.length === 0,
      chunksAdded: totalChunks,
      sourcesIngested,
      errors,
      durationMs: Date.now() - start,
    };
  }

  // ── Raw Text Ingestion ─────────────────────────────────────────────────────

  async ingestText(text: string, source: string): Promise<IngestResult> {
    const start = Date.now();
    const store = getVectorStore(this.siteId);
    const chunks = chunker.chunk(text, source, 'raw');
    await store.addChunks(chunks);
    return {
      success: true,
      chunksAdded: chunks.length,
      sourcesIngested: [source],
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  // ── Retrieval ──────────────────────────────────────────────────────────────

  /**
   * Retrieve context for a query.
   * If not enough quality chunks exist, returns a `hasSufficientContext: false`
   * flag and a `fallbackMessage` so the LLM can acknowledge the gap gracefully.
   */
  async retrieve(query: string, config: TenantConfig): Promise<RAGContext> {
    const store = getVectorStore(this.siteId);
    const maxResults = config.knowledgeBase?.maxResults ?? 5;
    const minScore = config.knowledgeBase?.minScore ?? 0.25;

    const results = await store.search(query, maxResults + 2, minScore * 0.8);

    // Hard filter at the configured threshold
    const qualified = results.filter((r) => r.score >= minScore);

    if (qualified.length === 0) {
      return {
        relevantChunks: [],
        contextText: '',
        hasSufficientContext: false,
        fallbackMessage:
          "I don't have specific information about that in my knowledge base. " +
          'Please reach out to the team directly or browse the website for more details.',
      };
    }

    // Deduplicate by source — keep the best-scoring chunk per source
    const seenSources = new Set<string>();
    const deduped = qualified.filter((r) => {
      if (seenSources.has(r.source)) return false;
      seenSources.add(r.source);
      return true;
    }).slice(0, maxResults);

    const contextText = deduped
      .map((r, i) => {
        const heading = r.sectionTitle ? ` — ${r.sectionTitle}` : '';
        return `[Reference ${i + 1}${heading}]\nSource: ${r.source}\n\n${r.text}`;
      })
      .join('\n\n---\n\n');

    return {
      relevantChunks: deduped,
      contextText,
      hasSufficientContext: true,
    };
  }

  // ── Management ─────────────────────────────────────────────────────────────

  /** Clear all vectors and re-ingest from ingestion.json */
  async reindex(): Promise<IngestResult> {
    logger.info(`[RAG:${this.siteId}] Starting full re-index...`);
    const store = getVectorStore(this.siteId);
    await store.clear();
    evictVectorStore(this.siteId);
    return this.ingest();
  }

  /** Remove all vectors permanently */
  async clearKnowledgeBase(): Promise<void> {
    const store = getVectorStore(this.siteId);
    await store.clear();
  }

  /** Remove a specific source from the index */
  async removeSource(source: string): Promise<number> {
    const store = getVectorStore(this.siteId);
    return store.removeSource(source);
  }

  async getStats(): Promise<{
    docCount: number;
    sources: Array<{ source: string; count: number; sourceType: string }>;
    ingestionConfig: IngestionConfig | null;
  }> {
    const store = getVectorStore(this.siteId);
    return {
      docCount: store.count,
      sources: store.listSources(),
      ingestionConfig: this.loadIngestionConfig(),
    };
  }

  // ── Ingestion Config ───────────────────────────────────────────────────────

  loadIngestionConfig(): IngestionConfig | null {
    const configPath = path.join(env.tenantsDir, this.siteId, 'ingestion.json');
    if (!fs.existsSync(configPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as IngestionConfig;
    } catch {
      return null;
    }
  }

  saveIngestionConfig(config: IngestionConfig): void {
    const configPath = path.join(env.tenantsDir, this.siteId, 'ingestion.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}

// ── Per-tenant pipeline cache ──────────────────────────────────────────────────

const pipelineCache = new Map<string, RAGPipeline>();

export function getRAGPipeline(siteId: string): RAGPipeline {
  if (!pipelineCache.has(siteId)) {
    pipelineCache.set(siteId, new RAGPipeline(siteId));
  }
  return pipelineCache.get(siteId)!;
}
