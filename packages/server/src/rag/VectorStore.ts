import fs from 'fs';
import path from 'path';
import { getEmbedder, tfidfEmbedder } from './Embedder';
import { TextChunk, VectorEntry, SearchResult } from './types';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface IVectorStore {
  addChunks(chunks: TextChunk[]): Promise<void>;
  search(query: string, topK?: number, minScore?: number): Promise<SearchResult[]>;
  removeSource(source: string): Promise<number>;
  clear(): Promise<void>;
  listSources(): Array<{ source: string; count: number; sourceType: string }>;
  get count(): number;
  get isLoaded(): boolean;
}

/**
 * Local in-memory vector store with JSON persistence.
 */
export class LocalVectorStore implements IVectorStore {
  private entries: VectorEntry[] = [];
  private siteId: string;
  private storePath: string;
  private loaded = false;
  private dirty = false;

  constructor(siteId: string) {
    this.siteId = siteId;
    this.storePath = path.join(env.dataDir, 'vectors', `${siteId}.json`);
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private async load(): Promise<void> {
    if (this.loaded) return;

    if (!fs.existsSync(this.storePath)) {
      this.entries = [];
      this.loaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(this.storePath, 'utf-8');
      this.entries = JSON.parse(raw) as VectorEntry[];
      logger.info(`[VectorStore:${this.siteId}] Loaded ${this.entries.length} vectors natively`);

      const docs = this.entries.map((e) => e.text);
      if (docs.length > 0) tfidfEmbedder.updateIDF(docs);
    } catch (err) {
      logger.error(`[VectorStore:${this.siteId}] Failed to load local store:`, err);
      this.entries = [];
    }

    this.loaded = true;
  }

  private flush(): void {
    if (!this.dirty) return;
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(this.entries, null, 0), 'utf-8');
    this.dirty = false;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async addChunks(chunks: TextChunk[]): Promise<void> {
    await this.load();
    if (chunks.length === 0) return;

    const embedder = getEmbedder();
    const texts = chunks.map((c) => c.text);

    tfidfEmbedder.updateIDF(texts);
    logger.info(`[VectorStore:${this.siteId}] Embedding ${texts.length} chunks locally...`);
    const vectors = await embedder.embedBatch(texts);

    const sourcesToReplace = new Set(chunks.map((c) => c.source));
    this.entries = this.entries.filter((e) => !sourcesToReplace.has(e.source));

    const newEntries: VectorEntry[] = chunks.map((chunk, i) => ({
      id: `${chunk.source}::${chunk.chunkIndex}`,
      text: chunk.text,
      source: chunk.source,
      sourceType: chunk.sourceType,
      vector: vectors[i],
      sectionTitle: chunk.sectionTitle,
      metadata: chunk.metadata,
      createdAt: new Date().toISOString(),
    }));

    this.entries.push(...newEntries);
    this.dirty = true;
    this.flush();
    logger.info(`[VectorStore:${this.siteId}] +${newEntries.length} vectors → total ${this.entries.length}`);
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async search(query: string, topK = 5, minScore = 0.2): Promise<SearchResult[]> {
    await this.load();
    if (this.entries.length === 0) return [];

    const embedder = getEmbedder();
    const queryVec = await embedder.embed(query);

    return this.entries
      .map((entry) => ({
        text: entry.text,
        source: entry.source,
        sourceType: entry.sourceType,
        score: cosineSimilarity(queryVec, entry.vector),
        sectionTitle: entry.sectionTitle,
        metadata: entry.metadata,
      }))
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async removeSource(source: string): Promise<number> {
    await this.load();
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.source !== source);
    const removed = before - this.entries.length;
    if (removed > 0) {
      this.dirty = true;
      this.flush();
      logger.info(`[VectorStore:${this.siteId}] Removed ${removed} vectors for source: ${source}`);
    }
    return removed;
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.dirty = true;
    this.flush();
    logger.info(`[VectorStore:${this.siteId}] Cleared locally`);
  }

  listSources(): Array<{ source: string; count: number; sourceType: string }> {
    const counts = new Map<string, { count: number; sourceType: string }>();
    for (const e of this.entries) {
      const existing = counts.get(e.source);
      if (existing) existing.count++;
      else counts.set(e.source, { count: 1, sourceType: e.sourceType });
    }
    return Array.from(counts.entries()).map(([source, { count, sourceType }]) => ({
      source,
      count,
      sourceType,
    }));
  }

  get count(): number { return this.entries.length; }
  get isLoaded(): boolean { return this.loaded; }
}

/**
 * Cloud vector store powered by Pinecone REST API.
 */
export class PineconeVectorStore implements IVectorStore {
  private siteId: string;
  private apiKey: string;
  private host: string;
  private loadedCount = 0;

  constructor(siteId: string) {
    this.siteId = siteId;
    this.apiKey = env.pineconeApiKey;
    this.host = env.pineconeHost;
    logger.info(`[VectorStore:${this.siteId}] Attached to remote Pinecone instance`);
  }

  // Helper for REST calls to Pinecone
  private async pineconeRequest(endpoint: string, payload: any) {
    if (!this.apiKey || !this.host) {
      throw new Error("Missing PINECONE_API_KEY or PINECONE_HOST");
    }
    const res = await fetch(`https://${this.host}${endpoint}`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.text();
      logger.error(`Pinecone Api Error: ${err}`);
      throw new Error(err);
    }
    return res.json();
  }

  async addChunks(chunks: TextChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const embedder = getEmbedder();
    const texts = chunks.map((c) => c.text);
    const vectors = await embedder.embedBatch(texts);

    const upsertVectors = chunks.map((c, i) => ({
      id: `${this.siteId}::${c.source}::${c.chunkIndex}`,
      values: vectors[i],
      metadata: {
        siteId: this.siteId,
        text: c.text,
        source: c.source,
        sourceType: c.sourceType,
        sectionTitle: c.sectionTitle ?? '',
      }
    }));

    // In a real implementation we would page these by batches of 100.
    await this.pineconeRequest('/vectors/upsert', { vectors: upsertVectors, namespace: this.siteId });
    this.loadedCount += chunks.length;
    logger.info(`[VectorStore:${this.siteId}] UPSERTED ${chunks.length} vectors to Pinecone namespace`);
  }

  async search(query: string, topK = 5, minScore = 0.2): Promise<SearchResult[]> {
    const embedder = getEmbedder();
    const queryVec = await embedder.embed(query);

    const response = await this.pineconeRequest('/query', {
      namespace: this.siteId,
      vector: queryVec,
      topK,
      includeMetadata: true
    }) as any;

    return (response.matches || [])
      .filter((m: any) => m.score >= minScore)
      .map((m: any) => ({
        text: m.metadata.text,
        source: m.metadata.source,
        sourceType: m.metadata.sourceType,
        score: m.score,
        sectionTitle: m.metadata.sectionTitle,
        metadata: m.metadata,
      }));
  }

  async removeSource(source: string): Promise<number> {
    // Pinecone REST deletion filtering requires metadata index structure. Example syntax:
    await this.pineconeRequest('/vectors/delete', {
      filter: { source: { $eq: source } },
      namespace: this.siteId
    });
    return 1; // Real impl would track deletion numbers from pinecone response
  }

  async clear(): Promise<void> {
    await this.pineconeRequest('/vectors/delete', { deleteAll: true, namespace: this.siteId });
    this.loadedCount = 0;
    logger.info(`[VectorStore:${this.siteId}] Cleared internal Pinecone Namespace: ${this.siteId}`);
  }

  listSources(): Array<{ source: string; count: number; sourceType: string }> {
    // Requires Pinecone metadata cardinality lookup, currently stubbed
    return [];
  }

  get count(): number { return this.loadedCount; }
  get isLoaded(): boolean { return true; }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

const storeCache = new Map<string, IVectorStore>();

export function getVectorStore(siteId: string): IVectorStore {
  if (!storeCache.has(siteId)) {
    // Inject logic checking if Pinecone details exist
    if (env.pineconeApiKey && env.pineconeHost) {
      storeCache.set(siteId, new PineconeVectorStore(siteId));
    } else {
      storeCache.set(siteId, new LocalVectorStore(siteId));
    }
  }
  return storeCache.get(siteId)!;
}

export function evictVectorStore(siteId: string): void {
  storeCache.delete(siteId);
}
