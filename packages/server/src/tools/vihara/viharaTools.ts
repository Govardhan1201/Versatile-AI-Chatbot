import { ToolDefinition } from '../ToolRegistry';

const OFFBEAT_PLACES: Record<string, {
  name: string; state: string; region: string; budget: 'low' | 'medium' | 'high';
  bestSeason: string[]; tags: string[]; description: string; transport: string;
  nearbyPlaces: string[];
}> = {
  chopta: {
    name: 'Chopta', state: 'Uttarakhand', region: 'North India',
    budget: 'low', bestSeason: ['Apr', 'May', 'Jun', 'Sep', 'Oct', 'Nov'],
    tags: ['trek', 'temple', 'meadows', 'nature', 'spiritual'],
    description: 'The "Mini Switzerland of India" — peaceful meadows, Tungnath temple (highest Shiva temple), dense rhododendron forests.',
    transport: 'Drive from Rishikesh (~8 hrs) or take a bus to Ukhimath then shared jeep.',
    nearbyPlaces: ['deoria-tal', 'kedarnath', 'auli'],
  },
  ziro: {
    name: 'Ziro Valley', state: 'Arunachal Pradesh', region: 'Northeast India',
    budget: 'medium', bestSeason: ['Mar', 'Apr', 'Sep', 'Oct'],
    tags: ['culture', 'tribal', 'music', 'nature', 'UNESCO'],
    description: 'UNESCO tentative heritage site. Home to the Apatani tribe, pine-capped hills, paddy fields, and the legendary Ziro Music Festival.',
    transport: 'Fly to Naharlagun, then road journey (~5 hrs). Or train to Naharlagun.',
    nearbyPlaces: ['itanagar', 'tawang'],
  },
  tarkarli: {
    name: 'Tarkarli', state: 'Maharashtra', region: 'West India',
    budget: 'low', bestSeason: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    tags: ['beach', 'diving', 'snorkeling', 'backwaters', 'coastal'],
    description: 'Maharashtra\'s best-kept coastal secret. Turquoise waters, scuba diving, backwater cruises on Karli river. Far less crowded than Goa.',
    transport: 'Drive from Mumbai (~9 hrs) or train to Kudal then taxi.',
    nearbyPlaces: ['malvan', 'sindhudurg'],
  },
  mechuka: {
    name: 'Mechuka Valley', state: 'Arunachal Pradesh', region: 'Northeast India',
    budget: 'medium', bestSeason: ['Oct', 'Nov', 'Apr', 'May'],
    tags: ['remote', 'landscape', 'culture', 'Tibetan', 'adventure'],
    description: 'One of India\'s most remote valleys, near the China border. Tibetan Buddhist influence, pristine rivers, and snow-capped peaks.',
    transport: 'Fly to Along, then road journey (10-12 hrs on mountain roads).',
    nearbyPlaces: ['along', 'pasighat'],
  },
  dzukou: {
    name: 'Dzükou Valley', state: 'Nagaland/Manipur border', region: 'Northeast India',
    budget: 'low', bestSeason: ['Jun', 'Jul', 'Aug', 'Sep'],
    tags: ['trek', 'flowers', 'landscape', 'monsoon', 'camping'],
    description: 'A surreal valley of seasonal lilies and rhododendrons. 8km trek to reach this paradise of blooms.',
    transport: 'Drive to Viswema village near Kohima, then 4km trek to base.',
    nearbyPlaces: ['kohima', 'imphal'],
  },
  hampi: {
    name: 'Hampi', state: 'Karnataka', region: 'South India',
    budget: 'low', bestSeason: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
    tags: ['heritage', 'ruins', 'bouldering', 'history', 'UNESCO'],
    description: 'UNESCO World Heritage Site of the Vijayanagara Empire. Ancient temples, boulder-strewn landscapes, and vibrant backpacker scene.',
    transport: 'Train to Hosapete (15km from Hampi), then auto/bus.',
    nearbyPlaces: ['badami', 'aihole', 'pattadakal'],
  },
  spiti: {
    name: 'Spiti Valley', state: 'Himachal Pradesh', region: 'North India',
    budget: 'medium', bestSeason: ['Jun', 'Jul', 'Aug', 'Sep'],
    tags: ['desert', 'mountain', 'monastery', 'adventure', 'remote'],
    description: 'Cold desert mountain valley at 12,500 ft. Ancient monasteries, dramatic landscapes, and star-filled nights.',
    transport: 'Drive from Manali via Rohtang Pass (summer only) or from Shimla via Kinnaur.',
    nearbyPlaces: ['kaza', 'kibber', 'key-monastery'],
  },
};

/** VIHARA: Recommend offbeat destinations based on filters */
export const recommendPlacesTool: ToolDefinition = {
  name: 'recommendPlaces',
  description: 'Recommend offbeat travel destinations from VIHARA\'s curated database based on filters like budget, season, region, or activity type.',
  executionSide: 'server',
  parameters: {
    type: 'object',
    properties: {
      budget: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Budget level' },
      season: { type: 'string', description: 'Month or season (e.g., "December", "monsoon")' },
      region: { type: 'string', description: 'Region preference (e.g., "Northeast India", "South India")' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Activity tags e.g. ["trek", "beach", "heritage"]' },
      limit: { type: 'number', description: 'Max number of recommendations (default 3)' },
    },
  },
  async handler(args) {
    const { budget, season, region, tags, limit = 3 } = args as {
      budget?: string; season?: string; region?: string; tags?: string[]; limit?: number;
    };

    let places = Object.values(OFFBEAT_PLACES);

    if (budget) places = places.filter((p) => p.budget === budget);

    if (season) {
      const monthAbbr = getMonthAbbr(season);
      if (monthAbbr) places = places.filter((p) => p.bestSeason.includes(monthAbbr));
    }

    if (region) {
      places = places.filter((p) => p.region.toLowerCase().includes(region.toLowerCase()));
    }

    if (tags && tags.length > 0) {
      places = places.filter((p) => tags.some((t: string) => p.tags.includes(t.toLowerCase())));
    }

    const top = places.slice(0, limit);

    if (top.length === 0) {
      return {
        success: true,
        message: 'No destinations found matching your criteria. Try broadening your filters!',
        data: [],
      };
    }

    const message = top
      .map((p, i) =>
        `**${i + 1}. ${p.name}** (${p.state})\n${p.description}\n🗓️ Best time: ${p.bestSeason.join(', ')}\n🚌 How to reach: ${p.transport}`
      )
      .join('\n\n');

    return { success: true, data: top, message };
  },
};

/** VIHARA: Compare two destinations */
export const comparePlacesTool: ToolDefinition = {
  name: 'comparePlaces',
  description: 'Compare two offbeat destinations side by side on budget, season, activities, and accessibility.',
  executionSide: 'server',
  parameters: {
    type: 'object',
    properties: {
      placeA: { type: 'string', description: 'First place name' },
      placeB: { type: 'string', description: 'Second place name' },
    },
    required: ['placeA', 'placeB'],
  },
  async handler(args) {
    const nameA = (args.placeA as string).toLowerCase().replace(/\s+/g, '-');
    const nameB = (args.placeB as string).toLowerCase().replace(/\s+/g, '-');

    const placeA = OFFBEAT_PLACES[nameA];
    const placeB = OFFBEAT_PLACES[nameB];

    if (!placeA && !placeB) {
      return { success: true, message: `I don't have detailed data for ${args.placeA} or ${args.placeB} in my database yet, but I can still share general information!` };
    }

    const a = placeA ?? { name: args.placeA, description: 'Custom destination', budget: 'N/A', bestSeason: [], tags: [], transport: 'Check locally', nearbyPlaces: [], state: '', region: '' };
    const b = placeB ?? { name: args.placeB, description: 'Custom destination', budget: 'N/A', bestSeason: [], tags: [], transport: 'Check locally', nearbyPlaces: [], state: '', region: '' };

    const message = `**${a.name} vs ${b.name}**\n\n` +
      `| Feature | ${a.name} | ${b.name} |\n` +
      `|---|---|---|\n` +
      `| 📍 State | ${a.state} | ${b.state} |\n` +
      `| 💰 Budget | ${a.budget} | ${b.budget} |\n` +
      `| 🗓️ Best Season | ${a.bestSeason.join(', ')} | ${b.bestSeason.join(', ')} |\n` +
      `| 🏷️ Activities | ${a.tags.join(', ')} | ${b.tags.join(', ')} |\n\n` +
      `**${a.name}:** ${a.description}\n\n**${b.name}:** ${b.description}`;

    return { success: true, data: { a, b }, message };
  },
};

/** VIHARA: Plan itinerary */
export const planItineraryTool: ToolDefinition = {
  name: 'planItinerary',
  description: 'Create a day-by-day itinerary for an offbeat trip based on duration, budget, and starting location.',
  executionSide: 'server',
  parameters: {
    type: 'object',
    properties: {
      days: { type: 'number', description: 'Number of days for the trip' },
      budget: { type: 'string', description: 'Budget level: low, medium, or high' },
      startingFrom: { type: 'string', description: 'City you are starting from' },
      interests: { type: 'array', items: { type: 'string' }, description: 'Interests/activity types' },
    },
    required: ['days'],
  },
  async handler(args) {
    const { days, budget = 'medium', startingFrom = 'Delhi', interests = [] } = args as {
      days: number; budget?: string; startingFrom?: string; interests?: string[];
    };

    const budgetPerDay = budget === 'low' ? '₹1,500–2,500' : budget === 'medium' ? '₹3,000–5,000' : '₹6,000+';

    const sample3Day = `**3-Day Offbeat Experience from ${startingFrom}**\n\n**Day 1:** Travel day — reach base location, check in to homestay, explore local market\n**Day 2:** Main trek/exploration — visit key attractions, interact with locals\n**Day 3:** Leisure morning, departure back\n\n💰 Estimated cost: ${budgetPerDay}/day`;
    const sample5Day = `**5-Day Offbeat Exploration from ${startingFrom}**\n\n**Day 1:** Depart — overnight journey\n**Day 2:** Arrive, rest, local exploration\n**Day 3:** Primary destination & main attractions\n**Day 4:** Side trip to nearby offbeat spot\n**Day 5:** Return journey\n\n💰 Estimated cost: ${budgetPerDay}/day`;
    const sample7Day = `**7-Day Offbeat Adventure from ${startingFrom}**\n\n**Day 1-2:** Travel + acclimatize\n**Day 3-4:** Primary destination deep dive\n**Day 5:** Side trip or village stay\n**Day 6:** Cultural immersion / local experience\n**Day 7:** Return\n\n💰 Estimated cost: ${budgetPerDay}/day\n💡 Interests covered: ${interests.join(', ') || 'general exploration'}`;

    const plan = days <= 3 ? sample3Day : days <= 5 ? sample5Day : sample7Day;

    return {
      success: true,
      message: plan + `\n\n_💡 For a personalized itinerary, share your preferred destinations and I'll customize this further!_`,
      data: { days, budget, startingFrom, interests },
    };
  },
};

function getMonthAbbr(input: string): string | null {
  const months: Record<string, string> = {
    january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr',
    may: 'May', june: 'Jun', july: 'Jul', august: 'Aug',
    september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
    monsoon: 'Jul', summer: 'May', winter: 'Dec', spring: 'Mar', autumn: 'Oct',
  };
  return months[input.toLowerCase()] ?? null;
}
