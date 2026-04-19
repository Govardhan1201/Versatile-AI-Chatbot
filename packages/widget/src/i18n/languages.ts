/**
 * Language Registry — all supported languages with display names,
 * Web Speech API BCP-47 codes, and RTL flag.
 *
 * This is the single source of truth for language metadata on the widget side.
 * The server reads the same codes via tenant config.
 */

export interface LangMeta {
  /** BCP-47 tag used by browser Speech APIs */
  bcp47: string;
  /** Human-readable native name */
  nativeName: string;
  /** Short display label for the language switcher */
  label: string;
  /** Flag emoji */
  flag: string;
  /** Right-to-left script */
  rtl?: boolean;
  /** Alternate BCP-47 tags that also map to this language */
  aliases?: string[];
}

export const LANGUAGES: Record<string, LangMeta> = {
  en: {
    bcp47: 'en-IN',
    nativeName: 'English',
    label: 'EN',
    flag: '🇬🇧',
    aliases: ['en-US', 'en-GB', 'en-AU', 'en-IN'],
  },
  hi: {
    bcp47: 'hi-IN',
    nativeName: 'हिन्दी',
    label: 'हिं',
    flag: '🇮🇳',
    aliases: ['hi'],
  },
  te: {
    bcp47: 'te-IN',
    nativeName: 'తెలుగు',
    label: 'తె',
    flag: '🇮🇳',
    aliases: ['te'],
  },
  ta: {
    bcp47: 'ta-IN',
    nativeName: 'தமிழ்',
    label: 'தமி',
    flag: '🇮🇳',
    aliases: ['ta'],
  },
  kn: {
    bcp47: 'kn-IN',
    nativeName: 'ಕನ್ನಡ',
    label: 'ಕನ್',
    flag: '🇮🇳',
    aliases: ['kn'],
  },
  ml: {
    bcp47: 'ml-IN',
    nativeName: 'മലയാളം',
    label: 'മലy',
    flag: '🇮🇳',
    aliases: ['ml'],
  },
  mr: {
    bcp47: 'mr-IN',
    nativeName: 'मराठी',
    label: 'मरा',
    flag: '🇮🇳',
    aliases: ['mr'],
  },
  bn: {
    bcp47: 'bn-IN',
    nativeName: 'বাংলা',
    label: 'বাং',
    flag: '🇮🇳',
    aliases: ['bn-BD', 'bn'],
  },
  gu: {
    bcp47: 'gu-IN',
    nativeName: 'ગુજરાતી',
    label: 'ગુ',
    flag: '🇮🇳',
    aliases: ['gu'],
  },
  fr: {
    bcp47: 'fr-FR',
    nativeName: 'Français',
    label: 'FR',
    flag: '🇫🇷',
    aliases: ['fr-CA'],
  },
  de: {
    bcp47: 'de-DE',
    nativeName: 'Deutsch',
    label: 'DE',
    flag: '🇩🇪',
  },
  es: {
    bcp47: 'es-ES',
    nativeName: 'Español',
    label: 'ES',
    flag: '🇪🇸',
    aliases: ['es-MX', 'es-US'],
  },
  ja: {
    bcp47: 'ja-JP',
    nativeName: '日本語',
    label: '日本',
    flag: '🇯🇵',
  },
  zh: {
    bcp47: 'zh-CN',
    nativeName: '中文',
    label: '中文',
    flag: '🇨🇳',
    aliases: ['zh-TW', 'zh-HK'],
  },
  ar: {
    bcp47: 'ar-SA',
    nativeName: 'العربية',
    label: 'عر',
    flag: '🇸🇦',
    rtl: true,
    aliases: ['ar-EG', 'ar'],
  },
  pt: {
    bcp47: 'pt-PT',
    nativeName: 'Português',
    label: 'PT',
    flag: '🇵🇹',
    aliases: ['pt-BR'],
  },
};

/** Resolve a raw BCP-47 string (e.g. "en-US", "hi") to our canonical 2-letter code */
export function normalizeLangCode(raw: string): string | null {
  const lower = raw.toLowerCase().split('-')[0];

  // Direct match
  if (LANGUAGES[lower]) return lower;

  // Alias match
  for (const [code, meta] of Object.entries(LANGUAGES)) {
    if (meta.aliases?.some((a) => a.toLowerCase().startsWith(lower))) {
      return code;
    }
  }

  return null;
}

/** Get BCP-47 tag suitable for SpeechRecognition/SpeechSynthesis */
export function getBCP47(langCode: string): string {
  return LANGUAGES[langCode]?.bcp47 ?? `${langCode}-${langCode.toUpperCase()}`;
}

/** Build system-prompt language instruction for a given 2-letter code */
export function getLangInstruction(langCode: string): string {
  const meta = LANGUAGES[langCode];
  if (!meta || langCode === 'en') return '';

  const name = meta.nativeName;
  return (
    ` Always respond in ${name} (${langCode}). ` +
    `If the user writes in English, still respond in ${name} unless they switch language.`
  );
}

/** Auto-detect the browser's preferred language and map to a supported language code */
export function detectBrowserLanguage(supportedCodes: string[]): string {
  const candidates = [
    navigator.language,
    ...(navigator.languages ?? []),
  ];

  for (const raw of candidates) {
    const code = normalizeLangCode(raw);
    if (code && supportedCodes.includes(code)) {
      return code;
    }
  }

  return 'en';
}

/**
 * Detect language from text heuristically using Unicode ranges.
 * Returns a 2-letter code or null if undetected.
 *
 * Handles Devanagari (hi/mr), Telugu, Tamil, Kannada, Malayalam,
 * Bengali, Gujarati, Arabic, CJK (zh/ja).
 */
export function detectTextLanguage(text: string): string | null {
  if (!text || text.length < 3) return null;

  const checks: Array<[RegExp, string]> = [
    [/[\u0900-\u097F]/, 'hi'],       // Devanagari → Hindi (also Marathi)
    [/[\u0C00-\u0C7F]/, 'te'],       // Telugu
    [/[\u0B80-\u0BFF]/, 'ta'],       // Tamil
    [/[\u0C80-\u0CFF]/, 'kn'],       // Kannada
    [/[\u0D00-\u0D7F]/, 'ml'],       // Malayalam
    [/[\u0980-\u09FF]/, 'bn'],       // Bengali
    [/[\u0A80-\u0AFF]/, 'gu'],       // Gujarati
    [/[\u0600-\u06FF]/, 'ar'],       // Arabic
    [/[\u4E00-\u9FFF\u3400-\u4DBF]/, 'zh'], // CJK → Chinese
    [/[\u3040-\u309F\u30A0-\u30FF]/, 'ja'], // Hiragana/Katakana → Japanese
    [/[\u0400-\u04FF]/, null],       // Cyrillic — no mapping, skip
  ];

  for (const [regex, code] of checks) {
    if (regex.test(text)) return code;
  }

  return null;
}
