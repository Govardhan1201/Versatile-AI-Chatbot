import OpenAI from 'openai';
import { LLMProvider, LLMOptions, StreamChunk, LLMTool } from './LLMProvider';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.openaiApiKey,
      baseURL: env.openaiBaseUrl,
    });
  }

  async streamChat({ messages, tools, tenantConfig, onChunk }: LLMOptions): Promise<void> {
    const model = tenantConfig.model?.model ?? env.openaiModel;
    const maxTokens = tenantConfig.model?.maxTokens ?? 1024;

    // Build OpenAI tool definitions
    const openAiTools: OpenAI.Chat.ChatCompletionTool[] | undefined =
      tools && tools.length > 0
        ? tools.map((t: LLMTool) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters as OpenAI.FunctionParameters,
            },
          }))
        : undefined;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature: tenantConfig.model?.temperature ?? 0.7,
        messages: messages.map((m) => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        tools: openAiTools,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          onChunk({ type: 'text', content: delta.content });
        }

        // Tool call handling
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function?.name) {
              try {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                onChunk({
                  type: 'tool_call',
                  toolName: tc.function.name,
                  toolArgs: args,
                  toolCallId: tc.id ?? `tc_${Date.now()}`,
                });
              } catch {
                // Partial tool call JSON — skip
              }
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'stop' || chunk.choices[0]?.finish_reason === 'tool_calls') {
          onChunk({ type: 'done' });
        }
      }
    } catch (err: unknown) {
      logger.error('OpenAI stream error:', err);
      const message = err instanceof Error ? err.message : 'LLM error';
      onChunk({ type: 'error', error: message });
    }
  }
}
