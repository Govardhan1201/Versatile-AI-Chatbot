import { TenantConfig, ToolResult, PageContext } from '@versatile-ai-bot/shared';
import { logger } from '../utils/logger';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema for parameters
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  // If 'client', the tool is executed client-side (widget handles it)
  executionSide: 'server' | 'client';
}

export interface ToolContext {
  siteId: string;
  tenantConfig: TenantConfig;
  sessionId: string;
  pageContext?: PageContext;
}



/** Registry of available tools — global + per-tenant registration */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.debug(`Tool registered: ${tool.name}`);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Get tools available for a specific tenant */
  getForTenant(config: TenantConfig): ToolDefinition[] {
    const allowed = config.allowedTools ?? [];
    if (allowed.length === 0) return [];
    return allowed
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => !!t);
  }

  /** Convert tools to LLM-compatible format */
  toLLMTools(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Security: only execute if tenant has this tool allowed
    const allowed = context.tenantConfig.allowedTools ?? [];
    if (!allowed.includes(toolName)) {
      logger.warn(`Tool ${toolName} not allowed for tenant ${context.siteId}`);
      return { success: false, error: 'Tool not permitted for this tenant' };
    }

    // Client-side tools are handled by the widget — return action payload
    if (tool.executionSide === 'client') {
      return {
        success: true,
        message: `Client action: ${toolName}`,
        clientAction: { type: toolName, payload: args },
      };
    }

    try {
      return await tool.handler(args, context);
    } catch (err) {
      logger.error(`Tool ${toolName} error:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' };
    }
  }

  listAll(): string[] {
    return [...this.tools.keys()];
  }
}

export const toolRegistry = new ToolRegistry();
