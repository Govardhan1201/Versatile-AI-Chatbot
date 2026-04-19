import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Server
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',

  // LLM
  llmProvider: optional('LLM_PROVIDER', 'mock') as 'mock' | 'openai',
  openaiApiKey: optional('OPENAI_API_KEY', ''),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),
  openaiBaseUrl: optional('OPENAI_BASE_URL', 'https://api.openai.com/v1'),

  // Embeddings
  embeddingsProvider: optional('EMBEDDINGS_PROVIDER', 'local') as 'local' | 'openai',

  // Admin
  adminUsername: optional('ADMIN_USERNAME', 'admin'),
  adminPassword: optional('ADMIN_PASSWORD', 'changeme123'),
  adminJwtSecret: optional('ADMIN_JWT_SECRET', 'dev-secret-change-in-production'),
  adminSessionExpiry: optional('ADMIN_SESSION_EXPIRY', '24h'),

  pineconeApiKey: optional('PINECONE_API_KEY', ''),
  pineconeHost: optional('PINECONE_HOST', ''),

  // Storage
  dataDir: path.resolve(optional('DATA_DIR', './data')),
  tenantsDir: path.resolve(optional('TENANTS_DIR', path.resolve(__dirname, '../../../../tenants'))),

  // Rate limiting
  defaultRateLimit: parseInt(optional('DEFAULT_RATE_LIMIT', '20'), 10),

  // CORS
  corsOrigins: optional('CORS_ORIGINS', '*'),

  // Crawler
  crawlerMaxPages: parseInt(optional('CRAWLER_MAX_PAGES', '50'), 10),
  crawlerDelayMs: parseInt(optional('CRAWLER_DELAY_MS', '500'), 10),
};
