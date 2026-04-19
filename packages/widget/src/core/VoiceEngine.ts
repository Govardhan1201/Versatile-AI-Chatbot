/** Web Speech API voice engine */
export interface VoiceEngineOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange: (state: VoiceState) => void;
  onError: (message: string) => void;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error' | 'unsupported';

export class VoiceEngine {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private state: VoiceState = 'idle';
  private onTranscript: (text: string, isFinal: boolean) => void;
  private onStateChange: (state: VoiceState) => void;
  private onError: (message: string) => void;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor(options: VoiceEngineOptions) {
    this.onTranscript = options.onTranscript;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;

    this.initRecognition();
    this.synthesis = window.speechSynthesis ?? null;
  }

  get isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  get isTTSSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  private initRecognition(lang = 'en-IN'): void {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      this.setState('unsupported');
      return;
    }

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = lang;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => this.setState('listening');
    this.recognition.onend = () => {
      if (this.state === 'listening') this.setState('idle');
    };
    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        this.setState('idle');
      } else {
        this.onError(`Microphone error: ${event.error}`);
        this.setState('error');
      }
    };
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript;
      const isFinal = last.isFinal;
      this.onTranscript(transcript, isFinal);
      if (isFinal) this.setState('processing');
    };
  }

  startListening(lang?: string): void {
    if (!this.isSupported) {
      this.onError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Stop TTS if speaking
    this.stopSpeaking();

    if (lang) this.initRecognition(lang);

    try {
      this.recognition?.start();
    } catch {
      this.onError('Could not start microphone. Please check permissions.');
    }
  }

  stopListening(): void {
    this.recognition?.stop();
    this.setState('idle');
  }

  speak(text: string, lang = 'en-IN'): void {
    if (!this.isTTSSupported || !this.synthesis) return;

    this.stopSpeaking();

    // Strip markdown for spoken text
    const cleanText = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/_Demo mode.+$/m, '')
      .slice(0, 1000); // Limit TTS length

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Try to find an appropriate voice
    const voices = this.synthesis.getVoices();
    const targetLangPrefix = lang.split('-')[0].toLowerCase();
    
    // 1. Exact match with localService
    // 2. Exact match
    // 3. Prefix match with localService
    // 4. Prefix match
    const preferred = 
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase() && v.localService) ??
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix) && v.localService) ?? 
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLangPrefix));

    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => this.setState('speaking');
    utterance.onend = () => this.setState('idle');
    utterance.onerror = () => this.setState('idle');

    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (this.synthesis?.speaking) {
      this.synthesis.cancel();
    }
  }

  setState(state: VoiceState): void {
    this.state = state;
    this.onStateChange(state);
  }

  get currentState(): VoiceState {
    return this.state;
  }

  setLanguage(lang: string): void {
    this.initRecognition(lang);
  }
}
