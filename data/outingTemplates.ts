export interface OutingTemplate {
  id: string;
  label: string;
  emoji: string;
  title: string;
  category: string;
  description: string;
  vibeTags: string[];
  capacity: number;
}

export const OUTING_TEMPLATES: OutingTemplate[] = [
  {
    id: "trek",
    label: "Sunrise trek",
    emoji: "🥾",
    title: "Sunrise trek + breakfast",
    category: "Trek / Outdoors",
    description: "Early start, great views, breakfast after. Bring good shoes and water.",
    vibeTags: ["Trekking & Treks", "Early Riser", "Photography"],
    capacity: 6,
  },
  {
    id: "food_crawl",
    label: "Food crawl",
    emoji: "🍜",
    title: "Street food crawl",
    category: "Food crawl",
    description: "Hopping between a few local favorites. Come hungry.",
    vibeTags: ["Foodie", "Foodie Explorer"],
    capacity: 5,
  },
  {
    id: "coffee",
    label: "Coffee & chill",
    emoji: "☕",
    title: "Coffee & conversation",
    category: "Coffee & chill",
    description: "Low-key hangout over coffee. Good for first-time group meetups.",
    vibeTags: ["Chai Over Coffee", "Bookworm"],
    capacity: 4,
  },
  {
    id: "gig",
    label: "Live gig",
    emoji: "🎸",
    title: "Live music night",
    category: "Gig / Live music",
    description: "Catching a gig together, meet up beforehand.",
    vibeTags: ["Live Music Gigs", "Indie Music"],
    capacity: 8,
  },
  {
    id: "game_night",
    label: "Game night",
    emoji: "🎮",
    title: "Board games / gaming night",
    category: "Gaming",
    description: "Casual games, snacks, good company.",
    vibeTags: ["Gamer", "Standup Comedy"],
    capacity: 6,
  },
  {
    id: "standing_dinner",
    label: "Standing dinner club",
    emoji: "🍽️",
    title: "Weekly dinner club",
    category: "Food crawl",
    description: "A recurring dinner with the same crew, different spot every week.",
    vibeTags: ["Foodie", "Live Music Gigs"],
    capacity: 6,
  },
];
