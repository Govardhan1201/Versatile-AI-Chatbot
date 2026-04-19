/**
 * Shared RAG layer types — used across Chunker, VectorStore, Pipeline, and Ingestion.
 */

export interface TextChunk {
  text: string;
  source: string;
  sourceType: 'file' | 'url' | 'raw' | 'sitemap';
  chunkIndex: number;
  sectionTitle?: string;
  metadata?: Record<string, string>;
}

export interface ChunkOptions {
  chunkSize: number;    // characters per chunk
  overlap: number;      // character overlap between adjacent chunks
  minLength: number;    // discard chunks shorter than this
}

export interface VectorEntry {
  id: string;
  text: string;
  source: string;
  sourceType: TextChunk['sourceType'];
  vector: number[];
  sectionTitle?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface SearchResult {
  text: string;
  source: string;
  sourceType: TextChunk['sourceType'];
  score: number;
  sectionTitle?: string;
  metadata?: Record<string, string>;
}

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
  description?: string;
  headings?: string[];
  lang?: string;
}

export interface IngestResult {
  success: boolean;
  chunksAdded: number;
  sourcesIngested: string[];
  errors: Array<{ source: string; message: string }>;
  durationMs: number;
}

export interface RAGContext {
  relevantChunks: SearchResult[];
  contextText: string;
  hasSufficientContext: boolean;
  fallbackMessage?: string;
}

/** Ingestion config stored per-tenant as ingestion.json */
export interface IngestionConfig {
  version: 1;
  sources: IngestionSource[];
}

export type IngestionSource =
  | FileIngestionSource
  | UrlIngestionSource
  | SitemapIngestionSource
  | RawIngestionSource;

export interface FileIngestionSource {
  type: 'file';
  /** Glob-compatible path relative to tenant knowledge/ dir */
  pattern: string;
  label?: string;
}

export interface UrlIngestionSource {
  type: 'url';
  url: string;
  label?: string;
  /** Max pages to crawl from this URL (BFS). Default: 20 */
  maxPages?: number;
  /** Only follow links matching these path prefixes */
  allowedPaths?: string[];
}

export interface SitemapIngestionSource {
  type: 'sitemap';
  url: string;
  label?: string;
  /** Only ingest URLs matching these path prefixes */
  allowedPaths?: string[];
  maxPages?: number;
}

export interface RawIngestionSource {
  type: 'raw';
  text: string;
  source: string;
  label?: string;
}
