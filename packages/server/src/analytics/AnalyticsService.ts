import { storage } from '../storage/StorageAdapter';
import { logger } from '../utils/logger';

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

export class AnalyticsService {
  async track(event: Omit<AnalyticsEvent, 'timestamp'>): Promise<void> {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    try {
      await storage.append('analytics', event.siteId, fullEvent);
    } catch (err) {
      logger.error('Analytics tracking error:', err);
    }
  }

  async getSummary(siteId: string, since?: Date): Promise<AnalyticsSummary> {
    const events = await storage.readAll<AnalyticsEvent>('analytics', siteId);

    const filtered = since
      ? events.filter((e) => new Date(e.timestamp) >= since)
      : events;

    const totalChats = filtered.filter((e) => e.type === 'chat_start').length;
    const totalMessages = filtered.filter((e) => e.type === 'chat_message').length;
    const successfulAnswers = filtered.filter((e) => e.type === 'chat_success').length;
    const failedQueries = filtered.filter((e) => e.type === 'knowledge_miss').length;
    const voiceUsage = filtered.filter((e) => e.type === 'voice_used').length;

    // Top questions
    const messageEvents = filtered.filter((e) => e.type === 'chat_message' && e.data?.query);
    const questionCounts = new Map<string, number>();
    for (const ev of messageEvents) {
      const q = ev.data?.query as string;
      if (q) questionCounts.set(q, (questionCounts.get(q) ?? 0) + 1);
    }
    const topQuestions = [...questionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([question, count]) => ({ question, count }));

    // Language usage
    const langCounts = new Map<string, number>();
    for (const ev of filtered) {
      if (ev.userLanguage) {
        langCounts.set(ev.userLanguage, (langCounts.get(ev.userLanguage) ?? 0) + 1);
      }
    }
    const languageBreakdown = Object.fromEntries(langCounts);

    // Tool usage
    const toolEvents = filtered.filter((e) => e.type === 'tool_used');
    const toolCounts = new Map<string, number>();
    for (const ev of toolEvents) {
      const tool = ev.data?.tool as string;
      if (tool) toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
    }
    const toolUsage = Object.fromEntries(toolCounts);

    // Popular pages
    const pageCounts = new Map<string, number>();
    for (const ev of filtered) {
      if (ev.pageUrl) {
        pageCounts.set(ev.pageUrl, (pageCounts.get(ev.pageUrl) ?? 0) + 1);
      }
    }
    const popularPages = [...pageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    return {
      siteId,
      period: since ? `since ${since.toISOString()}` : 'all time',
      totalChats,
      totalMessages,
      successfulAnswers,
      failedQueries,
      voiceUsage,
      topQuestions,
      languageBreakdown,
      toolUsage,
      popularPages,
    };
  }
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

export const analyticsService = new AnalyticsService();
