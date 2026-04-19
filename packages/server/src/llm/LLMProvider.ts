import { TenantConfig } from '@versatile-ai-bot/shared';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  error?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMOptions {
  messages: ChatMessage[];
  tools?: LLMTool[];
  tenantConfig: TenantConfig;
  onChunk: (chunk: StreamChunk) => void;
}

/** Abstract LLM provider interface */
export interface LLMProvider {
  name: string;
  streamChat(options: LLMOptions): Promise<void>;
}
