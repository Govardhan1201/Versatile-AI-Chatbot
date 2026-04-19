import { PublicTenantConfig } from '@versatile-ai-bot/shared';

type Theme = PublicTenantConfig['theme'];

export function getWidgetCSS(theme: Theme): string {
  const p = theme?.primaryColor ?? '#6366f1';
  const sec = theme?.secondaryColor ?? '#8b5cf6';
  const bg = theme?.backgroundColor ?? '#ffffff';
  const text = theme?.textColor ?? '#1f2937';
  const userBubble = theme?.bubbleUserColor ?? p;
  const botBubble = theme?.bubbleBotColor ?? '#f3f4f6';
  const radius = theme?.borderRadius ?? '16px';
  const font = theme?.fontFamily ?? 'Inter, system-ui, -apple-system, sans-serif';

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host { --vab-primary: ${p}; --vab-secondary: ${sec}; --vab-bg: ${bg}; --vab-text: ${text};
      --vab-user-bubble: ${userBubble}; --vab-bot-bubble: ${botBubble};
      --vab-radius: ${radius}; --vab-font: ${font}; position: fixed; z-index: 2147483647; }

    .vab-widget { font-family: var(--vab-font); position: fixed; z-index: 2147483647; }
    /* Position variations */
    .vab-position-bottom-right { bottom: 24px; right: 24px; }
    .vab-position-bottom-left { bottom: 24px; left: 24px; }
    .vab-position-inline { position: relative; z-index: 1; bottom: auto; right: auto; width: 100%; height: 100%; display: flex; flex-direction: column; }

    /* ─── LAUNCHER ─────────────────────────────────────────────────────────── */
    .vab-launcher {
      width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--vab-primary), var(--vab-secondary));
      color: white; font-size: 26px; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px color-mix(in srgb, var(--vab-primary) 40%, transparent);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
      position: relative; outline: none;
    }
    .vab-launcher:hover { transform: scale(1.1); box-shadow: 0 12px 40px color-mix(in srgb, var(--vab-primary) 55%, transparent); }
    .vab-launcher:focus-visible { outline: 3px solid var(--vab-primary); outline-offset: 3px; }
    .vab-launcher:active { transform: scale(0.95); }
    .vab-launcher-icon { transition: transform 0.3s; }

    /* ─── CHAT WINDOW ───────────────────────────────────────────────────────── */
    .vab-window {
      position: absolute; bottom: 84px; right: 0; width: 400px;
      background: color-mix(in srgb, var(--vab-bg) 95%, transparent);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-radius: var(--vab-radius);
      box-shadow: 0 12px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(0.96) translateY(12px); transform-origin: bottom right;
      opacity: 0; pointer-events: none;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
      max-height: 650px;
      height: 80vh;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .vab-window.vab-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    .vab-position-bottom-left .vab-window { right: auto; left: 0; transform-origin: bottom left; }
    
    .vab-position-inline .vab-window {
      position: relative; bottom: auto; right: auto; width: 100%; max-height: none; height: 100%;
      transform: none; opacity: 1; pointer-events: all; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.08); backdrop-filter: none; background: var(--vab-bg);
      border-radius: var(--vab-radius);
    }
    .vab-position-inline .vab-launcher { display: none !important; }
    .vab-position-inline .vab-minimize-btn { display: none !important; }

    @media (max-width: 480px) {
      .vab-widget:not(.vab-position-inline) .vab-window { width: calc(100vw - 32px); max-height: 80vh; right: -8px; bottom: 80px; border-radius: 20px; }
      .vab-widget:not(.vab-position-inline).vab-position-bottom-left .vab-window { left: -8px; right: auto; }
      .vab-widget:not(.vab-position-inline) { bottom: 16px; right: 20px; }
      .vab-position-inline .vab-window { width: 100%; border-radius: 12px; }
    }

    /* ─── HEADER ────────────────────────────────────────────────────────────── */
    .vab-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; gap: 12px;
      background: linear-gradient(135deg, var(--vab-primary) 0%, var(--vab-secondary) 100%);
      color: white;
    }
    .vab-header-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .vab-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .vab-avatar {
      width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
      background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0; border: 2px solid rgba(255,255,255,0.3);
    }
    .vab-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .vab-header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vab-header-status { display: flex; align-items: center; gap: 5px; font-size: 11px; opacity: 0.85; }
    .vab-status-dot {
      width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
      animation: vab-pulse 2s infinite;
    }
    @keyframes vab-pulse {
      0%, 100% { opacity: 1; } 50% { opacity: 0.5; }
    }
    .vab-minimize-btn, .vab-autospeak-btn {
      background: rgba(255,255,255,0.15); border: none; color: white; cursor: pointer;
      width: 28px; height: 28px; border-radius: 50%; font-size: 14px;
      display: flex; align-items: center; justify-content: center; transition: background 0.2s;
      padding: 0;
    }
    .vab-minimize-btn:hover, .vab-autospeak-btn:hover { background: rgba(255,255,255,0.25); }
    .vab-autospeak-btn.active { background: rgba(255,255,255,0.35); }
    .vab-lang-select {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
      color: white; border-radius: 8px; padding: 4px 6px; font-size: 11px;
      cursor: pointer; font-family: var(--vab-font); outline: none;
    }
    .vab-lang-select option { background: var(--vab-primary); color: white; }

    /* ─── MESSAGES ──────────────────────────────────────────────────────────── */
    .vab-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px;
      scroll-behavior: smooth;
    }
    .vab-messages::-webkit-scrollbar { width: 4px; }
    .vab-messages::-webkit-scrollbar-track { background: transparent; }
    .vab-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

    /* Welcome State */
    .vab-welcome { text-align: center; padding: 24px 12px; }
    .vab-welcome-icon { font-size: 48px; margin-bottom: 12px; display: block; }
    .vab-welcome-text { font-size: 14px; color: var(--vab-text); opacity: 0.7; line-height: 1.6; }

    /* Messages */
    .vab-message {
      display: flex; gap: 8px; animation: vab-slide-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .vab-user { flex-direction: row-reverse; }
    @keyframes vab-slide-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .vab-avatar-small {
      width: 28px; height: 28px; border-radius: 50%; overflow: hidden;
      background: linear-gradient(135deg, var(--vab-primary), var(--vab-secondary));
      display: flex; align-items: center; justify-content: center; font-size: 13px;
      flex-shrink: 0; align-self: flex-end;
    }
    .vab-avatar-small img { width: 100%; height: 100%; object-fit: cover; }
    .vab-bubble-wrap { display: flex; flex-direction: column; gap: 4px; max-width: 82%; }
    .vab-user .vab-bubble-wrap { align-items: flex-end; }

    .vab-bubble {
      padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.55;
      word-break: break-word;
    }
    .vab-user .vab-bubble {
      background: linear-gradient(135deg, var(--vab-primary), var(--vab-secondary));
      color: white; border-bottom-right-radius: 4px;
    }
    .vab-bot .vab-bubble {
      background: var(--vab-bot-bubble); color: var(--vab-text); border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .vab-streaming .vab-bubble::after {
      content: '▌'; display: inline-block; animation: vab-blink 0.7s infinite;
    }
    @keyframes vab-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

    .vab-msg-time { font-size: 10px; opacity: 0.45; padding: 0 4px; }

    /* Skeleton Loader (Premium) */
    .vab-skeleton-block {
      display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: 150px;
    }
    .vab-skeleton-line {
      height: 12px; border-radius: 6px; background: color-mix(in srgb, var(--vab-bot-bubble) 80%, #000);
      background: linear-gradient(90deg, 
        color-mix(in srgb, var(--vab-bot-bubble) 80%, rgba(0,0,0,0.04)) 25%, 
        color-mix(in srgb, var(--vab-bot-bubble) 50%, rgba(0,0,0,0.08)) 50%, 
        color-mix(in srgb, var(--vab-bot-bubble) 80%, rgba(0,0,0,0.04)) 75%
      );
      background-size: 200% 100%;
      animation: vab-skeleton-shimmer 2s infinite linear;
    }
    .vab-skeleton-line:nth-child(1) { width: 90%; }
    .vab-skeleton-line:nth-child(2) { width: 60%; }
    .vab-skeleton-line:nth-child(3) { width: 80%; }
    
    @keyframes vab-skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Error / Reconnect State */
    .vab-error-banner {
      background: #fef2f2; border-left: 4px solid #ef4444; color: #b91c1c;
      padding: 12px 14px; border-radius: 6px; margin-bottom: 8px; font-size: 13px;
      display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(239,68,68,0.1);
    }
    .vab-reconnect-btn {
      background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px;
      font-size: 11px; cursor: pointer; margin-left: auto; font-weight: 500;
    }
    .vab-reconnect-btn:hover { background: #dc2626; }

    /* Sources */
    .vab-sources { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; padding: 0 4px; }
    .vab-sources-label { font-size: 10px; opacity: 0.5; }
    .vab-source-tag {
      font-size: 10px; padding: 2px 6px; border-radius: 8px;
      background: color-mix(in srgb, var(--vab-primary) 12%, transparent);
      color: var(--vab-primary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ─── SUGGESTED PROMPTS ─────────────────────────────────────────────────── */
    .vab-chips {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px;
    }
    .vab-chip {
      background: color-mix(in srgb, var(--vab-primary) 8%, transparent);
      color: var(--vab-primary); border: 1px solid color-mix(in srgb, var(--vab-primary) 20%, transparent);
      border-radius: 20px; padding: 6px 12px; font-size: 12px; cursor: pointer;
      transition: all 0.2s; font-family: var(--vab-font); white-space: nowrap;
    }
    .vab-chip:hover { background: color-mix(in srgb, var(--vab-primary) 16%, transparent); transform: translateY(-1px); }

    /* ─── INPUT ─────────────────────────────────────────────────────────────── */
    .vab-input-area {
      display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px 10px;
      border-top: 1px solid rgba(0,0,0,0.06);
    }
    .vab-input {
      flex: 1; border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px;
      padding: 10px 14px; font-size: 14px; font-family: var(--vab-font);
      resize: none; outline: none; transition: border-color 0.2s;
      background: var(--vab-bg); color: var(--vab-text); min-height: 44px; max-height: 120px;
      line-height: 1.5;
    }
    .vab-input:focus { border-color: var(--vab-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vab-primary) 12%, transparent); }
    .vab-input:disabled { opacity: 0.5; cursor: not-allowed; }

    .vab-input-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

    .vab-send-btn {
      width: 44px; height: 44px; border-radius: 12px; border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--vab-primary), var(--vab-secondary));
      color: white; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .vab-send-btn:hover { transform: scale(1.05); box-shadow: 0 4px 16px color-mix(in srgb, var(--vab-primary) 40%, transparent); }
    .vab-send-btn:active { transform: scale(0.95); }
    .vab-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    .vab-voice-btn {
      width: 44px; height: 44px; border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.1);
      background: transparent; cursor: pointer; font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .vab-voice-btn:hover { background: color-mix(in srgb, var(--vab-primary) 8%, transparent); }
    .vab-voice-btn.listening {
      background: #fee2e2; border-color: #ef4444; color: #ef4444;
      animation: vab-mic-pulse 1s ease-in-out infinite;
    }
    .vab-voice-btn.speaking { background: color-mix(in srgb, var(--vab-primary) 12%, transparent); border-color: var(--vab-primary); }
    @keyframes vab-mic-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
      50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
    }

    /* Voice Bar */
    .vab-voice-bar {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px;
      background: linear-gradient(135deg, var(--vab-primary), var(--vab-secondary));
      color: white; font-size: 13px;
    }
    .vab-voice-waves { display: flex; gap: 3px; align-items: center; }
    .vab-voice-waves span {
      width: 3px; background: white; border-radius: 3px;
      animation: vab-wave 1s ease-in-out infinite;
    }
    .vab-voice-waves span:nth-child(1) { height: 8px; animation-delay: 0s; }
    .vab-voice-waves span:nth-child(2) { height: 14px; animation-delay: 0.1s; }
    .vab-voice-waves span:nth-child(3) { height: 20px; animation-delay: 0.2s; }
    .vab-voice-waves span:nth-child(4) { height: 14px; animation-delay: 0.3s; }
    .vab-voice-waves span:nth-child(5) { height: 8px; animation-delay: 0.4s; }
    @keyframes vab-wave {
      0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(1); }
    }
    .vab-voice-stop {
      margin-left: auto; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4);
      color: white; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 12px;
    }

    /* ─── FOOTER ────────────────────────────────────────────────────────────── */
    .vab-footer {
      text-align: center; font-size: 10px; padding: 6px; opacity: 0.35;
      color: var(--vab-text); border-top: 1px solid rgba(0,0,0,0.04);
    }

    /* ─── DARK MODE ─────────────────────────────────────────────────────────── */
    .vab-dark .vab-window { background: color-mix(in srgb, #1e1e2e 90%, transparent); --vab-bg: #1e1e2e; --vab-text: #cdd6f4; border-color: rgba(255,255,255,0.05); }
    .vab-position-inline .vab-dark .vab-window { background: #1e1e2e; }
    .vab-dark .vab-bot .vab-bubble { background: #313244; color: #cdd6f4; }
    .vab-dark .vab-input { background: #313244; color: #cdd6f4; border-color: #45475a; }
    .vab-dark .vab-input:focus { border-color: var(--vab-primary); }
    .vab-dark .vab-chip { background: rgba(99,102,241,0.12); color: #cdd6f4; border-color: rgba(255,255,255,0.1); }
    .vab-dark .vab-input-area { border-top-color: rgba(255,255,255,0.06); }
    .vab-dark .vab-error-banner { background: #451a1a; color: #fca5a5; border-left-color: #ef4444; }

    /* ─── MARKDOWN CONTENT ──────────────────────────────────────────────────── */
    .vab-p { margin: 0 0 8px; }
    .vab-p:last-child { margin-bottom: 0; }
    .vab-h1, .vab-h2, .vab-h3 { font-weight: 600; margin: 8px 0 4px; }
    .vab-h1 { font-size: 16px; } .vab-h2 { font-size: 15px; } .vab-h3 { font-size: 14px; }
    .vab-list { padding-left: 18px; margin: 4px 0; }
    .vab-list li { margin: 3px 0; }
    .vab-table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
    .vab-table th, .vab-table td { border: 1px solid rgba(0,0,0,0.1); padding: 5px 8px; text-align: left; }
    .vab-table th { background: color-mix(in srgb, var(--vab-primary) 10%, transparent); font-weight: 600; }
    .vab-code { background: rgba(0,0,0,0.07); padding: 10px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 6px 0; }
    .vab-inline-code { background: rgba(0,0,0,0.07); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: monospace; }
    .vab-hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 8px 0; }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `;
}
