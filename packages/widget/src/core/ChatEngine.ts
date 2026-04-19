import { ChatMessage, PageContext, PublicTenantConfig, ClientAction } from '@versatile-ai-bot/shared';

export type StreamEventType = 'chunk' | 'sources' | 'action' | 'done' | 'error';

export interface ChatEngineOptions {
  siteId: string;
  apiBaseUrl: string;
  onToken: (token: string) => void;
  onSources: (sources: string[]) => void;
  onAction: (action: ClientAction) => void;
  onDone: (sessionId: string) => void;
  onError: (message: string) => void;
}

export class ChatEngine {
  private siteId: string;
  private apiBaseUrl: string;
  private sessionId: string;
  private history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private eventSource: EventSource | null = null;
  private onToken: (token: string) => void;
  private onSources: (sources: string[]) => void;
  private onAction: (action: ClientAction) => void;
  private onDone: (sessionId: string) => void;
  private onError: (message: string) => void;

  constructor(options: ChatEngineOptions) {
    this.siteId = options.siteId;
    this.apiBaseUrl = options.apiBaseUrl;
    this.sessionId = generateSessionId();
    this.onToken = options.onToken;
    this.onSources = options.onSources;
    this.onAction = options.onAction;
    this.onDone = options.onDone;
    this.onError = options.onError;
  }

  async send(
    message: string,
    language: string,
    config: PublicTenantConfig,
    pageContext?: PageContext
  ): Promise<void> {
    // Add to history immediately
    this.history.push({ role: 'user', content: message });

    const body = {
      message,
      messages: this.history.slice(-10),
      sessionId: this.sessionId,
      language,
      pageContext,
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat/${this.siteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        this.onError((err as { error: string }).error ?? 'Failed to connect');
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        this.onError('Streaming not supported');
        return;
      }

      let buffer = '';
      let assistantMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Event type line — skip, we'll read data next
            continue;
          }
          if (line.startsWith('data: ')) {
            const eventLine = line.slice(6);
            // Look back for event type
          }
        }

        // Re-parse as SSE events
        const events = parseSSEBuffer(decoder.decode(value, { stream: false }), buffer);
        for (const ev of events) {
          this.handleSSEEvent(ev.event, ev.data);
          if (ev.event === 'chunk' && ev.data.text) {
            assistantMessage += ev.data.text;
          }
        }
      }

      // Final: parse full buffer
      const remaining = parseSSEChunk(buffer);
      for (const ev of remaining) {
        this.handleSSEEvent(ev.event, ev.data);
        if (ev.event === 'chunk' && ev.data.text) {
          assistantMessage += ev.data.text;
        }
      }

      if (assistantMessage) {
        this.history.push({ role: 'assistant', content: assistantMessage });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      this.onError(msg);
    }
  }

  private handleSSEEvent(event: string, data: Record<string, unknown>): void {
    switch (event) {
      case 'chunk':
        if (typeof data.text === 'string') this.onToken(data.text);
        break;
      case 'sources':
        if (Array.isArray(data.sources)) this.onSources(data.sources as string[]);
        break;
      case 'action':
        this.onAction(data as ClientAction);
        break;
      case 'done':
        this.onDone((data.sessionId as string) ?? this.sessionId);
        break;
      case 'error':
        this.onError((data.message as string) ?? 'Unknown error');
        break;
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  get currentSessionId(): string {
    return this.sessionId;
  }
}

interface ParsedSSEEvent { event: string; data: Record<string, unknown> }

function parseSSEBuffer(raw: string, _buffer: string): ParsedSSEEvent[] {
  return parseSSEChunk(raw);
}

function parseSSEChunk(raw: string): ParsedSSEEvent[] {
  const results: ParsedSSEEvent[] = [];
  const blocks = raw.split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    let event = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
    }

    if (dataStr) {
      try {
        results.push({ event, data: JSON.parse(dataStr) });
      } catch {
        // Skip malformed
      }
    }
  }

  return results;
}

function generateSessionId(): string {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}
