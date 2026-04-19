import fs from 'fs';
import path from 'path';
import { TenantConfig, TenantConfigSchema } from '@versatile-ai-bot/shared';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// In-memory cache to avoid repeated disk reads
const cache = new Map<string, TenantConfig>();

export class TenantManager {
  private tenantsDir: string;

  constructor(tenantsDir: string = env.tenantsDir) {
    this.tenantsDir = tenantsDir;
  }

  /** Load a tenant config by siteId. Returns null if not found. */
  async getTenant(siteId: string): Promise<TenantConfig | null> {
    const normalized = siteId.toLowerCase().trim();

    if (cache.has(normalized)) {
      return cache.get(normalized)!;
    }

    const configPath = path.join(this.tenantsDir, normalized, 'config.json');

    if (!fs.existsSync(configPath)) {
      logger.warn(`Tenant not found: ${normalized}`);
      return null;
    }

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const data = JSON.parse(raw);
      const parsed = TenantConfigSchema.parse(data);
      cache.set(normalized, parsed);
      logger.info(`Loaded tenant config: ${normalized}`);
      return parsed;
    } catch (err) {
      logger.error(`Failed to parse tenant config for ${normalized}:`, err);
      return null;
    }
  }

  /** List all available tenant IDs */
  async listTenants(): Promise<string[]> {
    if (!fs.existsSync(this.tenantsDir)) return [];

    return fs.readdirSync(this.tenantsDir).filter((name) => {
      const configPath = path.join(this.tenantsDir, name, 'config.json');
      return fs.statSync(path.join(this.tenantsDir, name)).isDirectory() && fs.existsSync(configPath);
    });
  }

  /** Save or update a tenant config */
  async saveTenant(config: TenantConfig): Promise<void> {
    const siteId = config.siteId;
    const tenantDir = path.join(this.tenantsDir, siteId);
    const configPath = path.join(tenantDir, 'config.json');

    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    // Create knowledge dir if it doesn't exist
    const knowledgeDir = path.join(tenantDir, 'knowledge');
    if (!fs.existsSync(knowledgeDir)) {
      fs.mkdirSync(knowledgeDir, { recursive: true });
    }

    const updated = { ...config, updatedAt: new Date().toISOString() };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    cache.set(siteId, updated);
    logger.info(`Saved tenant config: ${siteId}`);
  }

  /** Delete a tenant */
  async deleteTenant(siteId: string): Promise<boolean> {
    const tenantDir = path.join(this.tenantsDir, siteId);
    if (!fs.existsSync(tenantDir)) return false;

    fs.rmSync(tenantDir, { recursive: true, force: true });
    cache.delete(siteId);
    logger.info(`Deleted tenant: ${siteId}`);
    return true;
  }

  /** Invalidate cache for a tenant (force re-read from disk) */
  invalidateCache(siteId: string): void {
    cache.delete(siteId);
  }

  /** Validate that a request origin is allowed by this tenant */
  isOriginAllowed(config: TenantConfig, origin: string): boolean {
    if (config.allowedDomains.includes('*')) return true;
    if (!origin) return false;

    try {
      const { hostname } = new URL(origin);
      return config.allowedDomains.some((domain) => {
        // Support wildcard subdomains: *.example.com
        if (domain.startsWith('*.')) {
          const base = domain.slice(2);
          return hostname === base || hostname.endsWith(`.${base}`);
        }
        return hostname === domain;
      });
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const tenantManager = new TenantManager();
