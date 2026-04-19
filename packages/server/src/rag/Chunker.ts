import { TextChunk, ChunkOptions } from './types';

/**
 * Smart chunker with:
 * - Heading-aware markdown splitting (preserves heading as section title in each chunk)
 * - Sentence-boundary breaking with overlap
 * - JSON array support (one object per chunk)
 * - Minimal chunk deduplication
 */
export class Chunker {
  private defaults: ChunkOptions = {
    chunkSize: 900,
    overlap: 180,
    minLength: 60,
  };

  /**
   * Chunk plain text with sentence-boundary awareness.
   */
  chunk(
    text: string,
    source: string,
    sourceType: TextChunk['sourceType'] = 'raw',
    options: Partial<ChunkOptions> = {},
    metadata?: Record<string, string>,
  ): TextChunk[] {
    const { chunkSize, overlap, minLength } = { ...this.defaults, ...options };
    const normalized = normalizeWhitespace(text);
    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < normalized.length) {
      let end = Math.min(start + chunkSize, normalized.length);

      // Break at a good boundary if not at the end
      if (end < normalized.length) {
        end = findBreakPoint(normalized, end);
      }

      const chunkText = normalized.slice(start, end).trim();

      if (chunkText.length >= minLength) {
        chunks.push({
          text: chunkText,
          source,
          sourceType,
          chunkIndex: index++,
          metadata,
        });
      }

      start = end - overlap;
      if (start >= normalized.length || end === normalized.length) break;
    }

    return chunks;
  }

  /**
   * Chunk a Markdown document. Each H1/H2/H3 section is split independently,
   * and the heading text is stored as `sectionTitle` in each resulting chunk.
   */
  chunkMarkdown(
    markdown: string,
    source: string,
    sourceType: TextChunk['sourceType'] = 'file',
    options: Partial<ChunkOptions> = {},
    metadata?: Record<string, string>,
  ): TextChunk[] {
    // Split at heading boundaries
    const sectionRegex = /^#{1,3}\s.+$/m;
    const parts = markdown.split(/\n(?=#{1,3}\s)/);
    const allChunks: TextChunk[] = [];
    let globalIndex = 0;

    for (const part of parts) {
      if (!part.trim()) continue;

      // Extract heading as section title
      const headingMatch = part.match(/^(#{1,3})\s+(.+)/);
      const sectionTitle = headingMatch ? headingMatch[2].trim() : undefined;

      // Content is part minus the heading line
      const contentLines = part.split('\n');
      const bodyLines = headingMatch ? contentLines.slice(1) : contentLines;
      const body = bodyLines.join('\n').trim();

      // Include the heading text prepended to each chunk body for context
      const textToChunk = sectionTitle ? `${sectionTitle}\n\n${body}` : body;

      const sectionChunks = this.chunk(
        textToChunk,
        source,
        sourceType,
        options,
        metadata,
      );

      for (const chunk of sectionChunks) {
        allChunks.push({ ...chunk, sectionTitle, chunkIndex: globalIndex++ });
      }
    }

    // Fallback: if no headings, chunk the whole thing
    if (allChunks.length === 0) {
      return this.chunk(markdown, source, sourceType, options, metadata);
    }

    return allChunks;
  }

  /**
   * Chunk a JSON array — each top-level object becomes one chunk.
   * Each object's string fields are concatenated to form the chunk text.
   */
  chunkJSON(
    json: string,
    source: string,
    sourceType: TextChunk['sourceType'] = 'file',
    metadata?: Record<string, string>,
  ): TextChunk[] {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        // Single object: treat as one chunk
        return this.chunk(
          JSON.stringify(parsed, null, 2),
          source,
          sourceType,
          {},
          metadata,
        );
      }

      return parsed
        .map((item: unknown, i: number) => {
          if (typeof item !== 'object' || item === null) return null;
          // Concatenate string fields
          const text = Object.values(item as Record<string, unknown>)
            .filter((v) => typeof v === 'string')
            .join('\n');

          if (text.length < 20) return null;

          return {
            text,
            source,
            sourceType,
            chunkIndex: i,
            metadata: { ...metadata, jsonIndex: String(i) } as Record<string, string>,
          } as TextChunk;
        })
        .filter((c): c is Exclude<typeof c, null> => c !== null) as TextChunk[];
    } catch {
      // Not valid JSON — fall back to plain chunking
      return this.chunk(json, source, sourceType, {}, metadata);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Find the best break point at or before `near`.
 * Prefers paragraph → sentence → word boundaries.
 */
function findBreakPoint(text: string, near: number): number {
  // Paragraph break (blank line)
  const paraBreak = text.lastIndexOf('\n\n', near);
  if (paraBreak > near - 300 && paraBreak > 0) return paraBreak + 2;

  // Single newline
  const lineBreak = text.lastIndexOf('\n', near);
  if (lineBreak > near - 150 && lineBreak > 0) return lineBreak + 1;

  // Sentence boundaries
  const sentBreak = Math.max(
    text.lastIndexOf('. ', near),
    text.lastIndexOf('! ', near),
    text.lastIndexOf('? ', near),
    text.lastIndexOf('। ', near), // Hindi Devanagari danda
    text.lastIndexOf('۔ ', near), // Urdu full stop
  );
  if (sentBreak > near - 200 && sentBreak > 0) return sentBreak + 2;

  // Word boundary
  const wordBreak = text.lastIndexOf(' ', near);
  if (wordBreak > near - 60 && wordBreak > 0) return wordBreak + 1;

  return near;
}

export const chunker = new Chunker();
