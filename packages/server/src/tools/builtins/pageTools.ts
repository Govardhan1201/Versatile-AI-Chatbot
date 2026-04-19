import { ToolDefinition } from '../ToolRegistry';

/** Client-side: open a page URL in the host website */
export const openPageTool: ToolDefinition = {
  name: 'openPage',
  description: 'Navigate the user to a specific page or URL within the website.',
  executionSide: 'client',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL or path to navigate to' },
      label: { type: 'string', description: 'Human-readable description of the destination' },
    },
    required: ['url'],
  },
  async handler(args) {
    return {
      success: true,
      clientAction: { type: 'openPage', payload: { url: args.url, label: args.label } },
    };
  },
};

/** Client-side: scroll to a section by ID */
export const scrollToSectionTool: ToolDefinition = {
  name: 'scrollToSection',
  description: 'Scroll the page to a specific section by its ID.',
  executionSide: 'client',
  parameters: {
    type: 'object',
    properties: {
      sectionId: { type: 'string', description: 'The HTML element ID to scroll to' },
    },
    required: ['sectionId'],
  },
  async handler(args) {
    return {
      success: true,
      clientAction: { type: 'scrollToSection', payload: { sectionId: args.sectionId } },
    };
  },
};

/** Server-side: collect lead information */
export const collectLeadTool: ToolDefinition = {
  name: 'collectLead',
  description: 'Collect user contact information (name, email, phone) for follow-up.',
  executionSide: 'server',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User full name' },
      email: { type: 'string', format: 'email', description: 'User email address' },
      phone: { type: 'string', description: 'User phone number (optional)' },
      interest: { type: 'string', description: 'What the user is interested in' },
    },
    required: ['name', 'email'],
  },
  async handler(args, context) {
    // In production, save to CRM / email service
    // For now, log to storage
    const { storage } = await import('../../storage/StorageAdapter');
    await storage.append('leads', context.siteId, {
      ...args,
      siteId: context.siteId,
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Thank you ${args.name}! We've noted your contact details and will reach out soon.`,
    };
  },
};
