/** Minimal markdown renderer — no external dependencies */
export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = escapeHTML(text);

  // Code blocks (before inline code)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const inner = match.slice(3, -3).replace(/^[^\n]*\n/, ''); // remove language identifier
    return `<pre class="vab-code"><code>${inner}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="vab-inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Tables (simplified)
  html = html.replace(/(\|.+\|\n)+/g, (table) => {
    const rows = table.trim().split('\n').filter((r) => !r.match(/^\|[-| ]+\|$/));
    return '<table class="vab-table">' +
      rows.map((row, i) => {
        const cells = row.split('|').filter((_, idx, a) => idx > 0 && idx < a.length - 1);
        const tag = i === 0 ? 'th' : 'td';
        return `<tr>${cells.map((c) => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
      }).join('') +
      '</table>';
  });

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="vab-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="vab-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="vab-h1">$1</h1>');

  // Unordered lists
  html = html.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, '<ul class="vab-list">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="vab-hr">');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="vab-p">');
  html = html.replace(/\n/g, '<br>');

  return `<p class="vab-p">${html}</p>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
