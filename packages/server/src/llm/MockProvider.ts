import { LLMProvider, LLMOptions, StreamChunk } from './LLMProvider';

// Curated mock responses for VIHARA and generic use
const MOCK_RESPONSES: Record<string, string[]> = {
  vihara: [
    "🌿 **Chopta** in Uttarakhand is one of India's best-kept secrets! Often called the 'Mini Switzerland of India', it offers stunning meadows, dense forests, and the famous Tungnath temple — the highest Shiva temple in the world. Best visited between April–June or September–November.",
    "🏔️ For offbeat experiences, consider **Ziro Valley** in Arunachal Pradesh. It's a UNESCO World Heritage nomination site with rice fields, bamboo forests, and the vibrant Apatani tribe culture. The Ziro Music Festival (September) is absolutely incredible!",
    "🌊 **Tarkarli** in Maharashtra is a hidden coastal gem! It offers crystal-clear waters perfect for scuba diving and snorkeling, with a beautiful backwater cruise on the Karli river. Much less crowded than Goa and equally beautiful.",
    "🏕️ **Mechuka Valley** in Arunachal Pradesh feels like another world — surrounded by snow-capped peaks, with Tibetan-influenced culture and minimal tourist footprint. It's one of India's most remote and pristine destinations.",
    "🌸 **Dzukou Valley** on the Nagaland-Manipur border blooms spectacularly in monsoon season. The 8km trek rewards you with a surreal landscape of lilies and rhododendrons. Best from June to September!",
  ],
  default: [
    "I'm here to help you! Could you tell me more about what you're looking for?",
    "That's a great question! Let me help you find the best answer.",
    "I can assist you with that. Here's what I know about the topic...",
    "Sure! I'd be happy to help. Here are some suggestions based on your query.",
    "I understand what you're asking. Let me provide you with the most relevant information.",
  ],
};

/** Mock LLM provider — realistic streaming simulation, no API key needed */
export class MockProvider implements LLMProvider {
  name = 'mock';

  async streamChat({ messages, tenantConfig, onChunk }: LLMOptions): Promise<void> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userText = (lastUserMsg?.content ?? '').toLowerCase();
    const siteId = tenantConfig.siteId;

    // Pick a relevant mock response
    const pool = MOCK_RESPONSES[siteId] ?? MOCK_RESPONSES.default;
    let response = pool[Math.floor(Math.random() * pool.length)];

    // Keyword-based response shaping
    if (userText.includes('hello') || userText.includes('hi') || userText.includes('namaste')) {
      response = `${tenantConfig.welcomeMessage} 😊 I'm your AI assistant for **${tenantConfig.siteName}**. How can I help you today?`;
    } else if (userText.includes('voice') || userText.includes('speak')) {
      response = "🎙️ Voice support is enabled! You can click the microphone button to speak your question, and I'll respond with both text and voice.";
    } else if (userText.includes('language') || userText.includes('hindi') || userText.includes('telugu')) {
      response = "🌍 I support multiple languages! You can switch between English, Hindi (हिंदी), and Telugu (తెలుగు) using the language switcher at the top of the chat. I'll respond in your preferred language.";
    } else if (userText.includes('plan') || userText.includes('itinerary')) {
      response = "🗺️ **Sample 5-Day Offbeat North India Itinerary:**\n\n**Day 1-2:** Chopta, Uttarakhand — Trek to Tungnath temple, meadow walks\n**Day 3:** Drive to Auli — Skiing (winter) or panoramic views\n**Day 4:** Munsiyari — High-altitude village, Panchachuli peaks view\n**Day 5:** Return via Jim Corbett for a wildlife safari\n\n💡 Budget: ~₹15,000-20,000 per person (excluding flights)";
    } else if (userText.includes('budget') || userText.includes('cheap') || userText.includes('affordable')) {
      response = "💰 **Budget-Friendly Offbeat Picks:**\n\n• **Spiti Valley** — ₹800-1200/night homestays, stunning landscapes\n• **Chopta** — ₹500-800/night camps, Uttarakhand's hidden gem\n• **Hampi** — ₹600-1000/night, UNESCO World Heritage ruins\n• **Majuli** — World's largest river island, ₹400-700/night\n\nAll of these offer incredible experiences without burning your wallet! 🎒";
    }

    // Simulate streaming word by word
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      await sleep(30 + Math.random() * 40);
      onChunk({
        type: 'text',
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
      });
    }

    // Add demo mode notice
    await sleep(200);
    onChunk({
      type: 'text',
      content: '\n\n_💡 Demo mode — add your OpenAI API key in `.env` for real AI responses._',
    });

    onChunk({ type: 'done' });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
