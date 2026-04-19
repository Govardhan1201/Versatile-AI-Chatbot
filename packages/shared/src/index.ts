import { z } from 'zod';

export const ThemeSchema = z.object({
  primaryColor: z.string().default('#6366f1'),
  secondaryColor: z.string().default('#8b5cf6'),
  backgroundColor: z.string().default('#ffffff'),
  textColor: z.string().default('#1f2937'),
  bubbleUserColor: z.string().default('#6366f1'),
  bubbleBotColor: z.string().default('#f3f4f6'),
  borderRadius: z.string().default('16px'),
  fontFamily: z.string().default('Inter, system-ui, sans-serif'),
  darkMode: z.boolean().default(false),
  logoUrl: z.string().url().optional(),
  avatarUrl: z.string().url().optional(),
  launcherIcon: z.string().optional(), // emoji or URL
  position: z.enum(['bottom-right', 'bottom-left', 'inline']).default('bottom-right'),
});

export const VoiceSchema = z.object({
  enabled: z.boolean().default(false),
  defaultVoice: z.string().default('en-US'),
  pushToTalk: z.boolean().default(false),
  ttsEnabled: z.boolean().default(true),
  sttProvider: z.enum(['browser', 'openai']).default('browser'),
  ttsProvider: z.enum(['browser', 'openai']).default('browser'),
});

export const LanguagesSchema = z.object({
  supported: z.array(z.string()).default(['en']),
  default: z.string().default('en'),
  autoDetect: z.boolean().default(true),
});

export const RateLimitSchema = z.object({
  requestsPerMinute: z.number().default(20),
  maxTokensPerSession: z.number().default(50000),
});

export const ModelSettingsSchema = z.object({
  provider: z.enum(['openai', 'mock']).default('mock'),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(1024),
  systemPrompt: z.string().default('You are a helpful AI assistant.'),
});

export const AnalyticsSchema = z.object({
  enabled: z.boolean().default(true),
  trackConversations: z.boolean().default(true),
  trackTools: z.boolean().default(true),
});

export const TenantConfigSchema = z.object({
  siteId: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  siteName: z.string().min(1),
  siteDescription: z.string().optional(),
  allowedDomains: z.array(z.string()).default(['*']),
  apiKey: z.string().optional(),
  theme: ThemeSchema.default({}),
  welcomeMessage: z.string().default('Hello! How can I help you?'),
  suggestedPrompts: z.array(z.string()).default([]),
  placeholderText: z.string().default('Type a message...'),
  chatTitle: z.string().optional(),
  model: ModelSettingsSchema.default({}),
  voice: VoiceSchema.default({}),
  languages: LanguagesSchema.default({}),
  allowedTools: z.array(z.string()).default([]),
  knowledgeBase: z.object({
    enabled: z.boolean().default(true),
    maxResults: z.number().default(5),
    minScore: z.number().default(0.3),
    citeSources: z.boolean().default(true),
  }).default({}),
  rateLimit: RateLimitSchema.default({}),
  analytics: AnalyticsSchema.default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  active: z.boolean().default(true),
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type TenantTheme = z.infer<typeof ThemeSchema>;

export interface PublicTenantConfig {
  siteId: string;
  siteName: string;
  chatTitle: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
  placeholderText: string;
  theme: TenantTheme;
  voice: { enabled: boolean };
  languages: { supported: string[]; default: string; autoDetect: boolean };
  knowledgeEnabled: boolean;
}

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: Date | string;
  sources?: string[];
  isStreaming?: boolean;
  name?: string;
  toolCallId?: string;
}

export interface PageContext {
  url?: string;
  title?: string;
  description?: string;
  pageType?: string;
  selectedText?: string;
  metadata?: Record<string, string>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
  clientAction?: {
    type: string;
    payload: unknown;
  };
}

export type EventType =
  | 'chat_start'
  | 'chat_message'
  | 'chat_success'
  | 'chat_failed'
  | 'tool_used'
  | 'voice_used'
  | 'language_changed'
  | 'knowledge_miss'
  | 'error';

export interface AnalyticsEvent {
  siteId: string;
  sessionId: string;
  type: EventType;
  timestamp: string;
  data?: Record<string, unknown>;
  userLanguage?: string;
  pageUrl?: string;
}

export interface AnalyticsSummary {
  siteId: string;
  period: string;
  totalChats: number;
  totalMessages: number;
  successfulAnswers: number;
  failedQueries: number;
  voiceUsage: number;
  topQuestions: Array<{ question: string; count: number }>;
  languageBreakdown: Record<string, number>;
  toolUsage: Record<string, number>;
  popularPages: Array<{ url: string; count: number }>;
}

export interface ClientAction {
  type: string;
  payload: Record<string, unknown>;
}
