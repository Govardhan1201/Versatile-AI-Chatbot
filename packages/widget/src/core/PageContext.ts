import { PageContext } from '@versatile-ai-bot/shared';

/** Extract useful context from the host page */
export function getPageContext(): PageContext {
  return {
    url: window.location.href,
    title: document.title,
    description:
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
      '',
    pageType:
      document.querySelector<HTMLMetaElement>('meta[name="page-type"]')?.content ??
      detectPageType(),
    selectedText: window.getSelection()?.toString().slice(0, 500) ?? '',
  };
}

function detectPageType(): string {
  const url = window.location.pathname.toLowerCase();
  if (url.includes('product') || url.includes('item')) return 'product';
  if (url.includes('blog') || url.includes('post') || url.includes('article')) return 'article';
  if (url.includes('contact')) return 'contact';
  if (url.includes('about')) return 'about';
  if (url.includes('destination') || url.includes('place') || url.includes('travel')) return 'destination';
  if (url.includes('faq') || url.includes('help')) return 'help';
  if (url === '/' || url === '/index.html') return 'home';
  return 'page';
}
