import { PublicTenantConfig, ChatMessage, ClientAction } from '@versatile-ai-bot/shared';
import { ChatEngine } from '../core/ChatEngine';
import { VoiceEngine, VoiceState } from '../core/VoiceEngine';
import { getPageContext } from '../core/PageContext';
import { renderMarkdown } from '../utils/markdown';
import { getWidgetCSS } from '../styles/widgetStyles';
import { LANGUAGES, detectBrowserLanguage, getBCP47 } from '../i18n/languages';

export interface WidgetOptions {
  siteId: string;
  apiBaseUrl: string;
  config: PublicTenantConfig;
}

export class Widget {
  private root: ShadowRoot;
  private container: HTMLElement;
  private config: PublicTenantConfig;
  private chatEngine: ChatEngine;
  private voiceEngine: VoiceEngine;
  private messages: ChatMessage[] = [];
  private isOpen = false;
  private isLoading = false;
  private language: string;
  private streamingMessageId: string | null = null;
  private voiceState: VoiceState = 'idle';
  private autoSpeak = false;

  constructor(private options: WidgetOptions) {
    this.config = options.config;
    
    // Determine initial language
    const supported = this.config.languages?.supported ?? ['en'];
    this.language = this.config.languages?.autoDetect
      ? detectBrowserLanguage(supported)
      : (this.config.languages?.default ?? 'en');

    // Create Shadow DOM host
    const host = document.createElement('div');
    host.id = 'versatile-ai-widget-host';
    host.setAttribute('data-site-id', options.siteId);
    document.body.appendChild(host);

    this.root = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow root
    const style = document.createElement('style');
    style.textContent = getWidgetCSS(options.config.theme);
    this.root.appendChild(style);

    // Create container
    this.container = document.createElement('div');
    this.container.className = `vab-widget vab-position-${options.config.theme?.position ?? 'bottom-right'}`;
    if (options.config.theme?.darkMode) this.container.classList.add('vab-dark');
    this.root.appendChild(this.container);

    // Init engines
    this.chatEngine = new ChatEngine({
      siteId: options.siteId,
      apiBaseUrl: options.apiBaseUrl,
      onToken: (token) => this.onStreamToken(token),
      onSources: (sources) => this.onSources(sources),
      onAction: (action) => this.onClientAction(action),
      onDone: (_sid) => this.onStreamDone(),
      onError: (msg) => this.onChatError(msg),
    });

    this.voiceEngine = new VoiceEngine({
      onTranscript: (text, isFinal) => this.onVoiceTranscript(text, isFinal),
      onStateChange: (state) => this.onVoiceStateChange(state),
      onError: (msg) => this.showError(msg),
    });

    this.render();
    this.attachEventListeners();

    // Listen for selected text changes on host page
    document.addEventListener('selectionchange', () => this.onSelectionChange());
  }

  private render(): void {
    this.container.innerHTML = this.buildHTML();
  }

  private buildHTML(): string {
    const cfg = this.config;
    const theme = cfg.theme;

    const launcherIcon = theme?.launcherIcon ?? '💬';
    const messagesHTML = this.messages.map((m) => this.buildMessageHTML(m)).join('');
    const suggestedHTML = this.messages.length === 0
      ? cfg.suggestedPrompts.map((p) =>
          `<button class="vab-chip" data-prompt="${escapeAttr(p)}">${escapeHTML(p)}</button>`
        ).join('')
      : '';

    const langOptions = (cfg.languages?.supported ?? ['en']).map((lang) =>
      `<option value="${lang}" ${lang === this.language ? 'selected' : ''}>${LANGUAGES[lang]?.label ?? lang.toUpperCase()}</option>`
    ).join('');

    const voiceBtn = cfg.voice?.enabled
      ? `<button class="vab-voice-btn ${this.voiceState}" id="vab-voice-btn" aria-label="Toggle voice input" title="Voice input">
          ${this.getVoiceIcon()}
        </button>`
      : '';

    const langSwitcher = cfg.languages?.supported?.length > 1
      ? `<select class="vab-lang-select" id="vab-lang-select" aria-label="Language">
          ${langOptions}
        </select>`
      : '';

    const autoSpeakBtn = cfg.voice?.enabled
      ? `<button class="vab-autospeak-btn ${this.autoSpeak ? 'active' : ''}" id="vab-autospeak-btn" aria-label="Auto-read responses" title="${this.autoSpeak ? 'Disable auto-speak' : 'Enable auto-speak'}">🔊</button>`
      : '';

    return `
      <!-- Launcher FAB -->
      <button class="vab-launcher" id="vab-launcher" 
        aria-label="Open chat" aria-expanded="${this.isOpen}" aria-controls="vab-window">
        <span class="vab-launcher-icon" id="vab-launcher-icon">
          ${this.isOpen ? '✕' : launcherIcon}
        </span>
      </button>

      <!-- Chat Window -->
      <div class="vab-window ${this.isOpen || theme?.position === 'inline' ? 'vab-open' : ''}" id="vab-window" role="region" aria-label="${escapeAttr(cfg.chatTitle ?? cfg.siteName)} chat window">
        
        <!-- Header -->
        <div class="vab-header">
          <div class="vab-header-left">
            <div class="vab-avatar" aria-hidden="true">
              ${theme?.avatarUrl
                ? `<img src="${theme.avatarUrl}" alt="${escapeAttr(cfg.siteName)}" />`
                : `<span>${theme?.launcherIcon ?? '🤖'}</span>`}
            </div>
            <div class="vab-header-info">
              <div class="vab-header-title">${escapeHTML(cfg.chatTitle ?? cfg.siteName)}</div>
              <div class="vab-header-status" id="vab-status">
                <span class="vab-status-dot"></span>
                <span id="vab-status-text">${this.isLoading ? 'Thinking...' : 'Online'}</span>
              </div>
            </div>
          </div>
          <div class="vab-header-actions">
            ${langSwitcher}
            ${autoSpeakBtn}
            <button class="vab-minimize-btn" id="vab-minimize" aria-label="Minimize chat">—</button>
          </div>
        </div>

        <!-- Messages -->
        <div class="vab-messages" id="vab-messages" role="log" aria-live="polite" aria-label="Chat messages">
          ${this.messages.length === 0 ? `
            <div class="vab-welcome">
              <div class="vab-welcome-icon" aria-hidden="true">${theme?.launcherIcon ?? '🤖'}</div>
              <div class="vab-welcome-text">${escapeHTML(cfg.welcomeMessage)}</div>
            </div>
          ` : ''}
          ${messagesHTML}
          ${this.isLoading && !this.streamingMessageId ? `
            <div class="vab-message vab-bot">
              <div class="vab-bubble" style="background: transparent; box-shadow: none; padding: 0;">
                <div class="vab-skeleton-block" aria-label="Loading response...">
                  <div class="vab-skeleton-line"></div>
                  <div class="vab-skeleton-line"></div>
                  <div class="vab-skeleton-line"></div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Suggested Prompts -->
        ${suggestedHTML ? `
          <div class="vab-chips" id="vab-chips" role="list" aria-label="Suggested questions">
            ${suggestedHTML}
          </div>
        ` : ''}

        <!-- Input Area -->
        <div class="vab-input-area">
          <textarea
            class="vab-input"
            id="vab-input"
            placeholder="${escapeAttr(cfg.placeholderText)}"
            rows="1"
            aria-label="Chat message"
            aria-multiline="true"
            maxlength="2000"
            ${this.isLoading ? 'disabled' : ''}
          ></textarea>
          <div class="vab-input-actions">
            ${voiceBtn}
            <button class="vab-send-btn" id="vab-send" aria-label="Send message" ${this.isLoading ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>

        <!-- Voice Status Bar -->
        ${this.voiceState === 'listening' ? `
          <div class="vab-voice-bar" aria-live="polite">
            <div class="vab-voice-waves">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <span>Listening... speak now</span>
            <button class="vab-voice-stop" id="vab-voice-stop">Stop</button>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="vab-footer">
          Powered by <strong>VERSATILE AI</strong>
        </div>
      </div>
    `;
  }

  private buildMessageHTML(msg: ChatMessage): string {
    const isUser = msg.role === 'user';
    const contentHTML = isUser
      ? `<span>${escapeHTML(msg.content)}</span>`
      : renderMarkdown(msg.content);

    const sourcesHTML = msg.sources?.length
      ? `<div class="vab-sources">
          <span class="vab-sources-label">📎 Sources:</span>
          ${msg.sources.map((s) => `<span class="vab-source-tag" title="${escapeAttr(s)}">${escapeHTML(getSourceLabel(s))}</span>`).join('')}
        </div>`
      : '';

    const streamingClass = msg.isStreaming ? 'vab-streaming' : '';

    return `
      <div class="vab-message ${isUser ? 'vab-user' : 'vab-bot'} ${streamingClass}" 
        data-id="${escapeAttr(msg.id)}" role="${isUser ? 'status' : 'article'}">
        ${!isUser ? `<div class="vab-avatar-small" aria-hidden="true">
          ${this.config.theme?.avatarUrl
            ? `<img src="${this.config.theme.avatarUrl}" alt="" />`
            : `<span>${this.config.theme?.launcherIcon ?? '🤖'}</span>`}
        </div>` : ''}
        <div class="vab-bubble-wrap">
          <div class="vab-bubble" id="msg-${escapeAttr(msg.id)}">${contentHTML}</div>
          ${sourcesHTML}
          <div class="vab-msg-time">${formatTime(msg.timestamp)}</div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    this.root.addEventListener('click', (e) => this.handleClick(e));
    this.root.addEventListener('keydown', (e) => this.handleKeydown(e as KeyboardEvent));
    this.root.addEventListener('input', (e) => this.handleInput(e));
    this.root.addEventListener('change', (e) => this.handleChange(e));
    
    // Listen for custom retry events
    this.root.host.addEventListener('vab-retry', () => {
      // Find last user message and resend
      const lastUserMsg = [...this.messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        // Remove error message
        this.messages = this.messages.filter(m => !m.content.includes('vab-error-banner'));
        this.sendText(lastUserMsg.content);
      }
    });
  }

  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;

    if (target.closest('#vab-launcher')) {
      this.toggle();
    } else if (target.closest('#vab-minimize')) {
      this.close();
    } else if (target.closest('#vab-send')) {
      this.sendMessage();
    } else if (target.closest('#vab-voice-btn')) {
      this.toggleVoice();
    } else if (target.closest('#vab-voice-stop')) {
      this.voiceEngine.stopListening();
    } else if (target.closest('#vab-autospeak-btn')) {
      this.autoSpeak = !this.autoSpeak;
      this.render();
      this.attachEventListeners();
    } else if (target.closest('.vab-chip')) {
      const btn = target.closest('.vab-chip') as HTMLElement;
      const prompt = btn.dataset.prompt ?? '';
      if (prompt) this.sendText(prompt);
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.id === 'vab-input') {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    }
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    if (target.id === 'vab-input') {
      // Auto-resize textarea
      target.style.height = 'auto';
      target.style.height = Math.min(target.scrollHeight, 120) + 'px';
    }
  }

  private handleChange(e: Event): void {
    const target = e.target as HTMLSelectElement;
    if (target.id === 'vab-lang-select') {
      this.language = target.value;
      this.voiceEngine.setLanguage(getBCP47(this.language));
    }
  }

  private toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.render();
    this.attachEventListeners();
    this.scrollToBottom();

    // Focus input
    setTimeout(() => {
      (this.root.getElementById('vab-input') as HTMLTextAreaElement)?.focus();
    }, 300);
  }

  private close(): void {
    this.isOpen = false;
    this.render();
    this.attachEventListeners();
  }

  private sendMessage(): void {
    const input = this.root.getElementById('vab-input') as HTMLTextAreaElement;
    const text = input?.value?.trim();
    if (text) this.sendText(text);
  }

  private async sendText(text: string): Promise<void> {
    if (this.isLoading || !text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    this.messages.push(userMsg);

    // Create placeholder bot message for streaming
    const botMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    this.messages.push(botMsg);
    this.streamingMessageId = botMsg.id;

    this.isLoading = true;
    this.render();
    this.attachEventListeners();
    this.scrollToBottom();

    const pageCtx = getPageContext();

    await this.chatEngine.send(text, this.language, this.config, pageCtx);
  }

  private onStreamToken(token: string): void {
    if (!this.streamingMessageId) return;
    const msg = this.messages.find((m) => m.id === this.streamingMessageId);
    if (!msg) return;

    msg.content += token;

    // Update just the bubble to avoid full re-render during streaming
    const bubble = this.root.getElementById(`msg-${this.streamingMessageId}`);
    if (bubble) {
      bubble.innerHTML = renderMarkdown(msg.content);
    }

    this.scrollToBottom();
  }

  private onSources(sources: string[]): void {
    if (!this.streamingMessageId) return;
    const msg = this.messages.find((m) => m.id === this.streamingMessageId);
    if (msg) msg.sources = sources;
  }

  private onClientAction(action: ClientAction): void {
    switch (action.type) {
      case 'openPage': {
        const { url } = action.payload as { url: string };
        if (url) window.location.href = url;
        break;
      }
      case 'scrollToSection': {
        const { sectionId } = action.payload as { sectionId: string };
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        break;
      }
    }
  }

  private onStreamDone(): void {
    if (this.streamingMessageId) {
      const msg = this.messages.find((m) => m.id === this.streamingMessageId);
      if (msg) {
        msg.isStreaming = false;
        if (this.autoSpeak && msg.content) {
          this.voiceEngine.speak(msg.content, getBCP47(this.language));
        }
      }
    }
    this.streamingMessageId = null;
    this.isLoading = false;
    this.render();
    this.attachEventListeners();
    this.scrollToBottom();
  }

  private onChatError(message: string): void {
    const msg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: `<div class="vab-error-banner" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <span>${escapeHTML(message)}</span>
                  <button class="vab-reconnect-btn" onclick="this.getRootNode().host.dispatchEvent(new CustomEvent('vab-retry'))">Retry</button>
                </div>`,
      timestamp: new Date(),
    };
    this.messages.push(msg);

    // Remove the empty streaming message if still there
    if (this.streamingMessageId) {
      this.messages = this.messages.filter((m) => {
        if (m.id === this.streamingMessageId && m.content === '') return false;
        return true;
      });
    }

    this.streamingMessageId = null;
    this.isLoading = false;
    this.render();
    this.attachEventListeners();
    this.scrollToBottom();
  }

  private showError(message: string): void {
    this.onChatError(message);
  }

  private onVoiceTranscript(text: string, isFinal: boolean): void {
    const input = this.root.getElementById('vab-input') as HTMLTextAreaElement;
    if (input) {
      input.value = text;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }

    if (isFinal && text.trim()) {
      setTimeout(() => this.sendMessage(), 300);
    }
  }

  private onVoiceStateChange(state: VoiceState): void {
    this.voiceState = state;

    // Update voice button only
    const voiceBtn = this.root.getElementById('vab-voice-btn');
    const statusText = this.root.getElementById('vab-status-text');

    if (voiceBtn) {
      voiceBtn.className = `vab-voice-btn ${state}`;
      voiceBtn.innerHTML = this.getVoiceIcon();
    }
    if (statusText) {
      statusText.textContent = state === 'listening' ? 'Listening...'
        : state === 'speaking' ? 'Speaking...'
        : state === 'processing' ? 'Processing...'
        : 'Online';
    }

    // Show/hide voice bar
    const existingBar = this.root.querySelector('.vab-voice-bar');
    if (state === 'listening' && !existingBar) {
      const msgs = this.root.getElementById('vab-messages');
      if (msgs) msgs.insertAdjacentHTML('afterend', `
        <div class="vab-voice-bar" aria-live="polite">
          <div class="vab-voice-waves">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <span>Listening... speak now</span>
          <button class="vab-voice-stop" id="vab-voice-stop">Stop</button>
        </div>
      `);
    } else if (state !== 'listening' && existingBar) {
      existingBar.remove();
    }
  }

  private getVoiceIcon(): string {
    if (this.voiceState === 'listening') return '⏹';
    if (this.voiceState === 'speaking') return '🔊';
    return '🎙️';
  }

  private toggleVoice(): void {
    if (this.voiceState === 'listening') {
      this.voiceEngine.stopListening();
    } else {
      this.voiceEngine.startListening(getBCP47(this.language));
    }
  }

  private onSelectionChange(): void {
    // Nothing active needed — page context is fetched at send time
  }

  private scrollToBottom(): void {
    const msgs = this.root.getElementById('vab-messages');
    if (msgs) {
      requestAnimationFrame(() => {
        msgs.scrollTop = msgs.scrollHeight;
      });
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getSourceLabel(source: string): string {
  if (source.startsWith('http')) {
    try { return new URL(source).pathname.split('/').filter(Boolean).pop() ?? source; } catch { return source; }
  }
  return source.replace('knowledge/', '').replace(/\.(md|txt)$/, '');
}
