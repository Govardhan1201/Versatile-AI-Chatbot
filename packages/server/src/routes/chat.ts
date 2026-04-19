import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { domainGuard } from '../middleware/domainGuard';
import { createRateLimiter } from '../middleware/rateLimiter';
import { TenantConfig, ChatMessage } from '@versatile-ai-bot/shared';
import { MockProvider } from '../llm/MockProvider';
import { OpenAIProvider } from '../llm/OpenAIProvider';
import { LLMProvider } from '../llm/LLMProvider';
import { getRAGPipeline } from '../rag/RAGPipeline';
import { toolRegistry } from '../tools/ToolRegistry';
import { analyticsService } from '../analytics/AnalyticsService';
import { storage } from '../storage/StorageAdapter';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();
const rateLimiter = createRateLimiter();

// Lazy LLM provider init
let _llmProvider: LLMProvider | null = null;
function getLLMProvider(): LLMProvider {
  if (!_llmProvider) {
    _llmProvider = env.llmProvider === 'openai' ? new OpenAIProvider() : new MockProvider();
    logger.info(`LLM provider: ${_llmProvider.name}`);
  }
  return _llmProvider;
}

/** POST /api/chat/:siteId — main chat endpoint with streaming */
router.post('/:siteId', rateLimiter, domainGuard, async (req: Request, res: Response) => {
  const config: TenantConfig = (req as Request & { tenant: TenantConfig }).tenant;
  const siteId = req.params.siteId;

  const {
    message,
    messages: historyMessages = [],
    sessionId = uuidv4(),
    language = 'en',
    pageContext,
  } = req.body as {
    message: string;
    messages?: ChatMessage[];
    sessionId?: string;
    language?: string;
    pageContext?: Record<string, string>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Sanitize: limit message length
  const sanitizedMessage = message.slice(0, 2000).trim();

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Track analytics
  await analyticsService.track({
    siteId, sessionId, type: 'chat_message',
    data: { query: sanitizedMessage },
    userLanguage: language,
    pageUrl: pageContext?.url,
  });

  try {
    // 1. Build RAG context if knowledge base is enabled
    let ragContext = '';
    let ragSources: string[] = [];

    if (config.knowledgeBase?.enabled) {
      const rag = getRAGPipeline(siteId);
      const result = await rag.retrieve(sanitizedMessage, config);

      if (result.hasSufficientContext) {
        ragContext = result.contextText;
        ragSources = [...new Set(result.relevantChunks.map((c) => c.source))];
      } else {
        // Inject fallback instruction into system prompt
        ragContext = result.fallbackMessage
          ? `NOTE: ${result.fallbackMessage}`
          : '';
        await analyticsService.track({ siteId, sessionId, type: 'knowledge_miss', data: { query: sanitizedMessage } });
      }
    }

    // 2. Build page context injection
    let pageContextText = '';
    if (pageContext?.url) {
      pageContextText =
        `\n\nThe user is currently on: ${pageContext.url}` +
        (pageContext.title ? ` | Page: "${pageContext.title}"` : '') +
        (pageContext.description ? `\nPage description: ${pageContext.description}` : '') +
        (pageContext.selectedText ? `\nUser selected text: "${pageContext.selectedText}"` : '');
    }

    // 3. Build language instruction
    const langInstructions: Record<string, string> = {
      en: '',
      hi: ' You must respond ONLY in Hindi (हिन्दी). Do not use English unless citing a specific proper noun.',
      te: ' You must respond ONLY in Telugu (తెలుగు). Do not use English unless citing a specific proper noun.',
      ta: ' You must respond ONLY in Tamil (தமிழ்).',
      kn: ' You must respond ONLY in Kannada (ಕನ್ನಡ).',
      ml: ' You must respond ONLY in Malayalam (മലയാളം).',
      bn: ' You must respond ONLY in Bengali (বাংলা).',
      fr: ' You must respond ONLY in French (Français).',
      es: ' You must respond ONLY in Spanish (Español).',
      de: ' You must respond ONLY in German (Deutsch).',
      ja: ' You must respond ONLY in Japanese (日本語).',
      zh: ' You must respond ONLY in Chinese (中文).',
      ar: ' You must respond ONLY in Arabic (العربية).',
    };
    const langInstruction = langInstructions[language.split('-')[0].toLowerCase()] 
      ?? ` Always respond in the user's language: ${language}.`;

    // 4. Build system prompt
    const systemPrompt = [
      config.model?.systemPrompt ?? 'You are a helpful AI assistant.',
      langInstruction,
      pageContextText,
      ragContext.startsWith('NOTE:')
        ? `\n\n## Context Note:\n${ragContext}`
        : ragContext
          ? `\n\n## Relevant Knowledge Base Content:\n${ragContext}\n\nUse this information to answer accurately. Cite sources when helpful. Do NOT make up facts not in this context.`
          : '',
    ].join('');

    // 5. Build message history
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-10), // keep last 10 turns for context
      { role: 'user', content: sanitizedMessage },
    ];

    // 6. Get available tools for this tenant
    const availableTools = toolRegistry.getForTenant(config);
    const llmTools = availableTools.length > 0 ? toolRegistry.toLLMTools(availableTools) : undefined;

    // 7. Stream LLM response
    const provider = getLLMProvider();
    let fullResponse = '';

    await provider.streamChat({
      messages,
      tools: llmTools,
      tenantConfig: config,
      onChunk: async (chunk) => {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
          sendEvent('chunk', { text: chunk.content });
        } else if (chunk.type === 'tool_call' && chunk.toolName) {
          // Execute tool
          const result = await toolRegistry.execute(chunk.toolName, chunk.toolArgs ?? {}, {
            siteId,
            tenantConfig: config,
            sessionId,
            pageContext,
          });

          await analyticsService.track({ siteId, sessionId, type: 'tool_used', data: { tool: chunk.toolName } });

          // Send tool result back as context and stream it
          if (result.message) {
            fullResponse += result.message;
            sendEvent('chunk', { text: result.message });
          }

          // If the tool has a client action, send it
          if (result.clientAction) {
            sendEvent('action', result.clientAction);
          }
        } else if (chunk.type === 'done') {
          // Include sources in response
          if (ragSources.length > 0 && config.knowledgeBase?.citeSources) {
            sendEvent('sources', { sources: ragSources });
          }

          // Save conversation log
          await storage.append('logs', siteId, {
            sessionId, timestamp: new Date().toISOString(),
            userMessage: sanitizedMessage, botResponse: fullResponse,
            language, pageContext, ragSources,
          });

          await analyticsService.track({ siteId, sessionId, type: 'chat_success' });
          sendEvent('done', { sessionId });
          res.end();
        } else if (chunk.type === 'error') {
          sendEvent('error', { message: chunk.error ?? 'An error occurred' });
          res.end();
        }
      },
    });
  } catch (err) {
    logger.error(`Chat route error for ${siteId}:`, err);
    sendEvent('error', { message: 'Internal server error. Please try again.' });
    res.end();
  }
});

export default router;
