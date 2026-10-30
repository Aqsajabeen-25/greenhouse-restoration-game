export interface Species {
  id: string;
  name: string;
  latin: string;
  icon: string; // lucide key hint, rendered via color + shape
  color: string;
  glow: string;
  description: string;
  personality: string;
  temp: [number, number];
  humidity: [number, number];
  light: [number, number];
  growthDays: number;
  difficulty: 1 | 2 | 3;
  seedYield: [number, number];
}

export const SPECIES: Species[] = [
  {
    id: "fernwhisper",
    name: "Moonpetal Fern",
    latin: "Filix lunapetala",
    icon: "fern",
    color: "#34d399",
    glow: "rgba(52,211,153,0.45)",
    description:
      "A soft luminescent fern that was the dome's first carpet. Drinks mist, shuns harsh sun.",
    personality: "Loves cool mist and shade. A forgiving first friend.",
    temp: [40, 65],
    humidity: [55, 90],
    light: [15, 50],
    growthDays: 2,
    difficulty: 1,
    seedYield: [2, 3],
  },
  {
    id: "sunspire",
    name: "Ember Bloom",
    latin: "Ignis spira",
    icon: "flame",
    color: "#fb923c",
    glow: "rgba(251,146,60,0.5)",
    description:
      "A cactus-flower that stores sun in its ribs. Cracks its buds only in dry heat and blaze.",
    personality: "Craves hot, dry, brilliant light. Hates soggy air.",
    temp: [68, 95],
    humidity: [5, 40],
    light: [65, 100],
    growthDays: 3,
    difficulty: 2,
    seedYield: [2, 3],
  },
  {
    id: "mistorchid",
    name: "Mist Orchid",
    latin: "Orchis nebulosa",
    icon: "orchid",
    color: "#c084fc",
    glow: "rgba(192,132,252,0.5)",
    description:
      "An epiphyte that sips drifting fog. Its petals bead with dew when the dome breathes right.",
    personality: "Warm and very humid, with gentle filtered light.",
    temp: [55, 75],
    humidity: [65, 95],
    light: [40, 70],
    growthDays: 3,
    difficulty: 2,
    seedYield: [2, 3],
  },
  {
    id: "gloomcap",
    name: "Gloomcap",
    latin: "Mycena umbra",
    icon: "mushroom",
    color: "#67e8f9",
    glow: "rgba(103,232,249,0.5)",
    description:
      "A lantern mushroom from the dome's shady floor. Glows brighter the darker and damper it gets.",
    personality: "Cool, soaked, and shadowy. Light burns it.",
    temp: [10, 40],
    humidity: [70, 100],
    light: [0, 35],
    growthDays: 2,
    difficulty: 2,
    seedYield: [2, 4],
  },
  {
    id: "skyvine",
    name: "Glasswing Vine",
    latin: "Vitis vitrea",
    icon: "vine",
    color: "#a3e635",
    glow: "rgba(163,230,53,0.45)",
    description:
      "A climbing gourd-vine that once trellised the whole east arcade. Wants sun with a breeze of dry air.",
    personality: "Warm, bright, and balanced humidity.",
    temp: [50, 80],
    humidity: [40, 70],
    light: [55, 90],
    growthDays: 4,
    difficulty: 3,
    seedYield: [2, 3],
  },
  {
    id: "heartbloom",
    name: "Heartbloom",
    latin: "Cor florae",
    icon: "heart",
    color: "#f472b6",
    glow: "rgba(244,114,182,0.6)",
    description:
      "The dome's keystone flower. Elara's last creation — it only opens when the whole ecosystem sings in balance.",
    personality: "Perfect balance. Warm-mild, soft humidity, even light.",
    temp: [45, 70],
    humidity: [50, 75],
    light: [45, 70],
    growthDays: 4,
    difficulty: 3,
    seedYield: [1, 2],
  },
];

export const speciesById = (id: string) =>
  SPECIES.find((s) => s.id === id) as Species;

export interface JournalEntry {
  id: number;
  title: string;
  date: string;
  locationHint: string;
  body: string[];
  rewardText?: string;
  rewardSeeds?: { speciesId: string; count: number };
  tip: string;
}

export const JOURNALS: JournalEntry[] = [
  {
    id: 0,
    title: "Sealed, but not dead",
    date: "Day 1 — Sealing",
    locationHint: "West entry path",
    body: [
      "If you read this, the dome has chosen you as it once chose me.",
      "I sealed the glass when the blight came. Inside, the air still remembers how to be a forest. You must remind it.",
      "Start small. The Moonpetal Ferns by the door still trust humans. Plant them in the dark soil, give them water from the pond, and sleep in my cot. Plants dream overnight — you will see.",
      "Clear only what you must. Every vine you cut can hide a seed.",
    ],
    tip: "Plant Moonpetal Fern in soil (stand next to dark soil, press E). Water daily. Sleep to grow.",
  },
  {
    id: 1,
    title: "The arid corner",
    date: "Day 14 — Sun-trap",
    locationHint: "Fern grotto, northwest",
    body: [
      "The southeast glass magnifies the sun cruelly — perfect for one thing only.",
      "I coaxed Ember Blooms to live there, fat with stored light. They sulk in mist. Give them heat, drought, and blaze. If their leaves pale, the air is too wet.",
      "I left two Ember seeds pressed in this page. Don't waste them on shade.",
    ],
    rewardText: "Found 2× Ember Bloom seeds pressed in the page!",
    rewardSeeds: { speciesId: "sunspire", count: 2 },
    tip: "Ember Bloom wants HOT (68+), DRY (<40 humidity), BRIGHT (65+).",
  },
  {
    id: 2,
    title: "What the mist keeps",
    date: "Day 32 — Condensation",
    locationHint: "East arcade",
    body: [
      "Morning in the dome is a white sea. The Mist Orchids open only when they cannot tell petal from fog.",
      "Keep them warm and soaked, under veiled light. Too much sun and they bleach. Too cold and they close for a season.",
      "Listen: when humidity passes 70, you can hear the dome exhale.",
    ],
    tip: "Mist Orchid wants WARM (55-75), VERY HUMID (65+), medium light.",
  },
  {
    id: 3,
    title: "Under the bench",
    date: "Day 51 — Low light",
    locationHint: "North glass, behind the light console",
    body: [
      "Not everything wants sun. The Gloomcaps glow under my workbench where no ray reaches.",
      "Cool the dome, drown the air, shutter the lamps. In darkness they are lanterns. In brightness they are dust.",
      "I have scattered their spores in the old seed pods. Look for bulbous pods that tremble when you near.",
    ],
    rewardText: "Spore print reveals 2× Gloomcap seeds!",
    rewardSeeds: { speciesId: "gloomcap", count: 2 },
    tip: "Gloomcap wants COOL (<40 temp), SOAKED (70+ humidity), DARK (<35 light).",
  },
  {
    id: 4,
    title: "The trellis walk",
    date: "Day 77 — Climbing",
    locationHint: "Far east, beyond the thicket",
    body: [
      "The Glasswing Vine once held up the whole east roof. It fell when I stopped pruning — or when I stopped believing.",
      "It is greedy for light and warmth but hates to stand in swamp. Give it sun and breathing room. Four sleeps to fruit if it trusts the climate.",
      "If you restore the arcade, the butterflies will return first. Trust them. They are the dome's applause.",
    ],
    tip: "Glasswing Vine wants WARM-BRIGHT (55+ light), moderate humidity. Slow: 4 days.",
  },
  {
    id: 5,
    title: "The Heart",
    date: "Day 100 — Last entry",
    locationHint: "South beds, near the cot",
    body: [
      "I made one final seed from all the others. The Heartbloom.",
      "It will not grow for need, only for harmony. It wants nothing extreme — mild warmth, soft humidity, even light, all in balance, as a forest is.",
      "Plant it near the Heart Tree at the center. When the dome's vitality passes three-quarters and a Heartbloom opens, press your palm to the Heart and wake it.",
      "Forgive the overgrowth. I let it grow so something would still be alive when you arrived.",
    ],
    rewardText: "A golden seed falls from the binding: 1× Heartbloom!",
    rewardSeeds: { speciesId: "heartbloom", count: 1 },
    tip: "Heartbloom wants BALANCE (45-70 on all three). Grow one + reach 75% vitality, then touch the Heart.",
  },
];

export const ECOSYSTEM_STAGES = [
  {
    min: 0,
    name: "Dormant",
    epithet: "glass and dust",
    description:
      "The dome sleeps under dust. Fog clings to the panes. Only your lantern moves.",
    color: "#94a3b8",
  },
  {
    min: 20,
    name: "Stirring",
    epithet: "first green",
    description:
      "Seedlings crack the soil. Spores drift. The glass fog thins at the edges.",
    color: "#86efac",
  },
  {
    min: 40,
    name: "Blooming",
    epithet: "return of scent",
    description:
      "Flowers open in patches. Butterflies test their wings. The Heart Tree shivers.",
    color: "#4ade80",
  },
  {
    min: 65,
    name: "Thriving",
    epithet: "a choir",
    description:
      "The trellises hum with pollinators. Light falls in green shafts. The pond mirrors sky.",
    color: "#22d3ee",
  },
  {
    min: 85,
    name: "Eden",
    epithet: "the dome remembers",
    description:
      "The dome is a world again. Every breath is petal and rain. The Heart is ready.",
    color: "#f0abfc",
  },
];

export function stageForVitality(v: number) {
  let cur = ECOSYSTEM_STAGES[0];
  for (const s of ECOSYSTEM_STAGES) if (v >= s.min) cur = s;
  return cur;
}
