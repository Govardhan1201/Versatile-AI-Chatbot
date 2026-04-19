import { Widget } from './ui/Widget';
import { PublicTenantConfig } from './types';

// Global init function for the script tag
let isInitialized = false;

// Capture currentScript synchronously before any async/event loops
const currentScriptTag = document.currentScript as HTMLScriptElement | null;

async function bootstrap() {
  if (isInitialized) return;
  isInitialized = true;

  // Find the script tag that loaded this file
  const scriptTag = currentScriptTag;
  if (!scriptTag) {
    console.error('VersatileAIBot: Could not identify script tag. Use data-site-id attribute.');
    return;
  }

  const siteId = scriptTag.getAttribute('data-site-id');
  if (!siteId) {
    console.error('VersatileAIBot: Missing data-site-id attribute on script tag.');
    return;
  }

  // Derive API base URL from where the script is hosted
  // If loaded from https://my-domain.com/widget.js, apiBase is https://my-domain.com
  const scriptUrl = new URL(scriptTag.src);
  const apiBaseUrl = scriptUrl.origin;

  try {
    // Fetch tenant configuration
    const configRes = await fetch(`${apiBaseUrl}/api/config/${siteId}`);
    if (!configRes.ok) {
      console.error(`VersatileAIBot: Failed to load config for site ID '${siteId}'. Is the chatbot active?`);
      return;
    }

    const config: PublicTenantConfig = await configRes.json();

    // Mount the widget
    new Widget({
      siteId,
      apiBaseUrl,
      config,
    });

  } catch (err) {
    console.error('VersatileAIBot: Failed to initialize widget.', err);
  }
}

// Auto-bootstrap when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
