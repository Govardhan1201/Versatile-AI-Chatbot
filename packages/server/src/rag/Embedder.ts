import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Abstract embedder interface — swap providers without touching the rest of the pipeline.
 */
export interface EmbedderProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ── TF-IDF Local Embedder ──────────────────────────────────────────────────────

/**
 * Zero-dependency TF-IDF hash-trick embedder.
 * Accurate enough for factual Q&A over structured content.
 * Automatically updates IDF as new documents are added.
 */
export class TFIDFEmbedder implements EmbedderProvider {
  readonly name = 'local-tfidf';
  private idf: Map<string, number> = new Map();
  private readonly dim = 768;  // Bumped from 512 for better separation

  embed(text: string): Promise<number[]> {
    return Promise.resolve(this.computeVector(text));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.computeVector(t));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s\u0900-\u097F\u0C00-\u0C7F]/g, ' ') // keep Devanagari + Telugu
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  private hash(token: string): number {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % this.dim;
  }

  // Secondary hash for double-hashing to reduce collisions
  private hash2(token: string): number {
    let h = 5381;
    for (let i = 0; i < token.length; i++) {
      h = ((h << 5) + h) ^ token.charCodeAt(i);
    }
    return Math.abs(h) % this.dim;
  }

  private computeVector(text: string): number[] {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return new Array(this.dim).fill(0);

    const termFreq = new Map<string, number>();
    for (const t of tokens) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);

    const vec = new Float32Array(this.dim);
    for (const [term, freq] of termFreq) {
      const tf = freq / tokens.length;
      const idf = this.idf.get(term) ?? 1.5; // default IDF for unseen terms
      const weight = tf * idf;
      const i1 = this.hash(term);
      const i2 = this.hash2(term);
      vec[i1] += weight;
      vec[i2] += weight * 0.5; // second bucket with lower weight
    }

    return normalize(Array.from(vec));
  }

  /**
   * Update IDF from a corpus of document strings.
   * Call this before embedding a new batch.
   */
  updateIDF(documents: string[]): void {
    const docCount = documents.length;
    if (docCount === 0) return;

    const termDocCount = new Map<string, number>();
    for (const doc of documents) {
      const uniqueTokens = new Set(this.tokenize(doc));
      for (const token of uniqueTokens) {
        termDocCount.set(token, (termDocCount.get(token) ?? 0) + 1);
      }
    }

    for (const [term, count] of termDocCount) {
      // Smoothed IDF: log((N+1)/(df+1)) + 1
      this.idf.set(term, Math.log((docCount + 1) / (count + 1)) + 1);
    }

    logger.debug(`[Embedder] IDF updated: ${termDocCount.size} terms over ${docCount} docs`);
  }

  get vocabSize(): number {
    return this.idf.size;
  }
}

// ── OpenAI Embedder ────────────────────────────────────────────────────────────

/**
 * OpenAI text-embedding-3-small provider.
 * Activated when EMBEDDINGS_PROVIDER=openai and OPENAI_API_KEY is set.
 * Automatically batches up to 100 texts per API call.
 */
class OpenAIEmbedder implements EmbedderProvider {
  readonly name = 'openai-embedding-3-small';
  private apiKey: string;
  private baseUrl: string;
  private model = 'text-embedding-3-small';
  private readonly BATCH_SIZE = 100;

  constructor() {
    this.apiKey = env.openaiApiKey;
    this.baseUrl = env.openaiBaseUrl;
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseUrl });

    const results: number[][] = [];

    // Process in batches to stay within API limits
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      const batch = texts.slice(i, i + this.BATCH_SIZE);

      const response = await client.embeddings.create({
        model: this.model,
        input: batch.map((t) => t.slice(0, 8191)), // API token limit
      });

      const batchResults = response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);

      results.push(...batchResults);
    }

    return results;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'can', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'this', 'that',
  'these', 'those', 'it', 'its', 'their', 'they', 'he', 'she', 'we', 'you',
  'as', 'if', 'then', 'than', 'so', 'up', 'out', 'all', 'about', 'into',
  'also', 'just', 'your', 'our', 'my', 'his', 'her', 'its',
]);

// ── Singleton factory ──────────────────────────────────────────────────────────

let _embedder: EmbedderProvider | null = null;

export function getEmbedder(): EmbedderProvider {
  if (!_embedder) {
    if (env.embeddingsProvider === 'openai' && env.openaiApiKey) {
      logger.info('[Embedder] Using OpenAI text-embedding-3-small');
      _embedder = new OpenAIEmbedder();
    } else {
      logger.info('[Embedder] Using local TF-IDF (768-dim, FNV hash)');
      _embedder = new TFIDFEmbedder();
    }
  }
  return _embedder;
}

/** Exposed for VectorStore to update IDF from loaded corpus */
export const tfidfEmbedder = new TFIDFEmbedder();
