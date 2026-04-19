import axios from 'axios';
import * as cheerio from 'cheerio';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { CrawledPage } from './types';

/**
 * Page crawler with:
 * - BFS up to maxPages within the same origin
 * - Sitemap.xml parsing for structured URL discovery
 * - allowedPaths filter to limit crawl scope
 * - Content extraction (main/article > body fallback)
 * - Polite delay between requests
 */
export class Crawler {
  private readonly userAgent =
    'VersatileAIBot/1.0 (chatbot knowledge crawler; +https://versatile-ai-bot.dev)';
  private readonly timeout = 12000;

  // ── Site Crawler (BFS) ─────────────────────────────────────────────────────

  async crawlSite(
    startUrl: string,
    maxPages: number = env.crawlerMaxPages,
    allowedPaths?: string[],
  ): Promise<CrawledPage[]> {
    const visited = new Set<string>();
    const queue: string[] = [normalizeUrl(startUrl)];
    const results: CrawledPage[] = [];

    const { origin } = new URL(startUrl);

    logger.info(`[Crawler] Starting BFS crawl from: ${startUrl} (max: ${maxPages})`);

    while (queue.length > 0 && results.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      if (allowedPaths && !isPathAllowed(url, allowedPaths)) continue;

      const page = await this.fetchPage(url);
      if (!page) continue;

      results.push(page);
      logger.debug(`[Crawler] ✓ ${url} (${page.content.length} chars)`);

      // Discover internal links
      const links = await this.extractLinks(url, origin);
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      await sleep(env.crawlerDelayMs);
    }

    logger.info(`[Crawler] Crawl done: ${results.length} pages from ${startUrl}`);
    return results;
  }

  // ── Sitemap Parser ─────────────────────────────────────────────────────────

  async crawlSitemap(
    sitemapUrl: string,
    maxPages: number = env.crawlerMaxPages,
    allowedPaths?: string[],
  ): Promise<CrawledPage[]> {
    logger.info(`[Crawler] Parsing sitemap: ${sitemapUrl}`);

    let urls: string[] = [];

    try {
      const response = await axios.get<string>(sitemapUrl, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        responseType: 'text',
      });

      const $ = cheerio.load(response.data, { xmlMode: true });

      // Support both urlset and sitemapindex
      if ($('sitemapindex').length > 0) {
        // It's a sitemap index — recursively fetch child sitemaps
        const childSitemaps = $('sitemap loc')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean);

        for (const childUrl of childSitemaps.slice(0, 5)) {
          const childPages = await this.crawlSitemap(
            childUrl,
            maxPages - urls.length,
            allowedPaths,
          );
          return childPages;
        }
      } else {
        // Regular urlset
        urls = $('url loc')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean)
          .map(normalizeUrl);
      }
    } catch (err) {
      logger.warn(`[Crawler] Sitemap fetch failed: ${err}`);
      return [];
    }

    if (allowedPaths) {
      urls = urls.filter((u) => isPathAllowed(u, allowedPaths));
    }

    urls = urls.slice(0, maxPages);
    logger.info(`[Crawler] Sitemap: ${urls.length} URLs to fetch`);

    const results: CrawledPage[] = [];
    for (const url of urls) {
      const page = await this.fetchPage(url);
      if (page) results.push(page);
      await sleep(env.crawlerDelayMs);
    }

    return results;
  }

  // ── Page Fetcher ───────────────────────────────────────────────────────────

  async fetchPage(url: string): Promise<CrawledPage | null> {
    try {
      const response = await axios.get<string>(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,hi;q=0.8,te;q=0.7',
        },
        maxRedirects: 4,
        responseType: 'text',
      });

      const ct = response.headers['content-type'] ?? '';
      if (!ct.includes('text/html') && !ct.includes('xhtml')) return null;

      return this.parseHTML(response.data as string, url);
    } catch (err) {
      logger.debug(`[Crawler] Fetch failed: ${url} — ${err}`);
      return null;
    }
  }

  // ── HTML Parser ────────────────────────────────────────────────────────────

  parseHTML(html: string, url: string): CrawledPage | null {
    const $ = cheerio.load(html);

    // Remove noise elements
    $(
      'script, style, noscript, nav, footer, header, aside, .cookie-banner, ' +
      '.ad, .advertisement, .sidebar, [aria-hidden="true"], ' +
      '[role="complementary"], .nav, .menu, .breadcrumb, .pagination',
    ).remove();

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim() ||
      $('h1').first().text().trim() ||
      url;

    const description =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      '';

    const lang =
      $('html').attr('lang')?.split('-')[0] ||
      $('meta[name="language"]').attr('content') ||
      'en';

    // Extract headings for metadata
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.push(text);
    });

    // Get the richest content block available
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-body',
      '#content',
      '#main',
      'body',
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const el = $(selector).first();
      if (el.length > 0) {
        content = normalizeText(el.text());
        if (content.length > 200) break;
      }
    }

    content = normalizeText(content);
    if (content.length < 80) return null;

    return { url, title, content, description, headings, lang };
  }

  // ── Link Extractor ─────────────────────────────────────────────────────────

  private async extractLinks(pageUrl: string, origin: string): Promise<string[]> {
    try {
      const response = await axios.get<string>(pageUrl, {
        timeout: this.timeout,
        headers: { 'User-Agent': this.userAgent },
        responseType: 'text',
      });

      const $ = cheerio.load(response.data as string);
      const links: string[] = [];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const resolved = new URL(href, pageUrl);
          // Same origin, no fragments, no external URLs
          if (
            resolved.origin === origin &&
            !resolved.href.includes('#') &&
            /^https?:/.test(resolved.href)
          ) {
            links.push(normalizeUrl(resolved.href));
          }
        } catch {
          // ignore malformed hrefs
        }
      });

      return [...new Set(links)];
    } catch {
      return [];
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = ''; // strip query params for deduplication
    return u.href.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function isPathAllowed(url: string, allowedPaths: string[]): boolean {
  try {
    const { pathname } = new URL(url);
    return allowedPaths.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const crawler = new Crawler();
