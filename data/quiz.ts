import { TraitKey } from "@/lib/types";

export interface QuizChoice {
  text: string;
  traits: Partial<Record<TraitKey, number>>; // points awarded 0-2
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: QuizChoice[];
}

// 10 quick questions. Each choice nudges 1-2 trait dimensions.
// Traits: extraversion, adventure, humor, depth, spontaneity (each summed then normalized 0-10)
export const VIBE_QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "It's Friday 9pm with no plans. You're most likely to...",
    choices: [
      { text: "Already texting the group chat for a plan", traits: { extraversion: 2, spontaneity: 1 } },
      { text: "Pick a new place none of us have tried", traits: { adventure: 2, spontaneity: 1 } },
      { text: "Order in and put on a comfort show", traits: { depth: 1 } },
      { text: "See who's up for something last minute", traits: { spontaneity: 2, extraversion: 1 } },
    ],
  },
  {
    id: "q2",
    prompt: "At a party full of strangers, you...",
    choices: [
      { text: "Work the whole room, meet everyone", traits: { extraversion: 2 } },
      { text: "Find one interesting conversation and stay there", traits: { depth: 2 } },
      { text: "Crack jokes till everyone's laughing", traits: { humor: 2, extraversion: 1 } },
      { text: "Vibe check first, ease in slowly", traits: { depth: 1, spontaneity: -1 } },
    ],
  },
  {
    id: "q3",
    prompt: "Your ideal weekend trip is...",
    choices: [
      { text: "Spontaneous road trip, no fixed itinerary", traits: { adventure: 2, spontaneity: 2 } },
      { text: "A planned trek or adventure sport", traits: { adventure: 2 } },
      { text: "A quiet hill town with a good book", traits: { depth: 2 } },
      { text: "Wherever the group decides, I'm just in", traits: { extraversion: 1, spontaneity: 1 } },
    ],
  },
  {
    id: "q4",
    prompt: "Your friends would describe your humor as...",
    choices: [
      { text: "Sarcastic and quick", traits: { humor: 2 } },
      { text: "Wholesome dad-joke energy", traits: { humor: 1, depth: 1 } },
      { text: "I'm the straight man, they're funny", traits: { depth: 1 } },
      { text: "Chaotic and unpredictable", traits: { humor: 1, spontaneity: 1 } },
    ],
  },
  {
    id: "q5",
    prompt: "A deep 2am conversation sounds...",
    choices: [
      { text: "Exactly my thing", traits: { depth: 2 } },
      { text: "Fun once in a while", traits: { depth: 1, extraversion: 1 } },
      { text: "Kind of draining honestly", traits: { extraversion: 1, depth: -1 } },
      { text: "Only with the right person", traits: { depth: 1 } },
    ],
  },
  {
    id: "q6",
    prompt: "Someone suggests bungee jumping tomorrow. You...",
    choices: [
      { text: "Already booked before they finish the sentence", traits: { adventure: 2, spontaneity: 2 } },
      { text: "In, but let me prep a little", traits: { adventure: 1 } },
      { text: "Hard pass, I'll cheer from the ground", traits: { adventure: -1, depth: 1 } },
      { text: "Depends who's coming", traits: { extraversion: 1 } },
    ],
  },
  {
    id: "q7",
    prompt: "In a group outing, you naturally become the...",
    choices: [
      { text: "Planner who keeps things moving", traits: { extraversion: 1, adventure: 1 } },
      { text: "Comic relief", traits: { humor: 2 } },
      { text: "One person actually talking to someone new", traits: { extraversion: 2 } },
      { text: "Quiet observer who remembers everything", traits: { depth: 2 } },
    ],
  },
  {
    id: "q8",
    prompt: "Your ideal first hangout with a new connection is...",
    choices: [
      { text: "Street food crawl, keep it casual", traits: { spontaneity: 1, extraversion: 1 } },
      { text: "Something active - sport, trek, dance class", traits: { adventure: 2 } },
      { text: "Coffee and an actual real conversation", traits: { depth: 2 } },
      { text: "A gig, comedy show, or fun event", traits: { humor: 1, extraversion: 1 } },
    ],
  },
  {
    id: "q9",
    prompt: "When plans change last minute, you feel...",
    choices: [
      { text: "Excited, keeps it interesting", traits: { spontaneity: 2 } },
      { text: "Fine as long as something still happens", traits: { spontaneity: 1 } },
      { text: "Mildly stressed, I like structure", traits: { spontaneity: -1, depth: 1 } },
      { text: "I'm usually the one changing the plan", traits: { spontaneity: 2, extraversion: 1 } },
    ],
  },
  {
    id: "q10",
    prompt: "Pick the caption for your life right now.",
    choices: [
      { text: "Say yes to everything", traits: { spontaneity: 2, adventure: 1 } },
      { text: "Building something, deep focus mode", traits: { depth: 2 } },
      { text: "Main character energy", traits: { extraversion: 2, humor: 1 } },
      { text: "Chasing the next big adventure", traits: { adventure: 2 } },
    ],
  },
];
