import { ToolDefinition } from '../ToolRegistry';
import { getRAGPipeline } from '../../rag/RAGPipeline';

/** Search the tenant's knowledge base */
export const searchKBTool: ToolDefinition = {
  name: 'searchWebsiteContent',
  description: 'Search the website knowledge base for information relevant to the user query.',
  executionSide: 'server',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
    },
    required: ['query'],
  },
  async handler(args, context) {
    const query = args.query as string;
    const rag = getRAGPipeline(context.siteId);
    const results = await rag.retrieve(query, context.tenantConfig);

    if (results.relevantChunks.length === 0) {
      return {
        success: true,
        message: 'No relevant information found in the knowledge base.',
        data: [],
      };
    }

    return {
      success: true,
      data: results.relevantChunks,
      message: results.contextText,
    };
  },
};
