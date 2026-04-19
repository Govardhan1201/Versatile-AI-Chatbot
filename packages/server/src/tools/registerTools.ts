import { toolRegistry } from './ToolRegistry';
import { searchKBTool } from './builtins/searchKB';
import { openPageTool, scrollToSectionTool, collectLeadTool } from './builtins/pageTools';
import { recommendPlacesTool, comparePlacesTool, planItineraryTool } from './vihara/viharaTools';
import { logger } from '../utils/logger';

/** Register all tools at startup */
export function registerAllTools(): void {
  // Built-in tools (available to any tenant)
  toolRegistry.register(searchKBTool);
  toolRegistry.register(openPageTool);
  toolRegistry.register(scrollToSectionTool);
  toolRegistry.register(collectLeadTool);

  // VIHARA-specific tools
  toolRegistry.register(recommendPlacesTool);
  toolRegistry.register(comparePlacesTool);
  toolRegistry.register(planItineraryTool);

  logger.info(`Registered ${toolRegistry.listAll().length} tools: ${toolRegistry.listAll().join(', ')}`);
}
