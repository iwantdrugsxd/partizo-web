export interface PromptDef {
  id: string;
  text: string;
}

// Curated, India-relevant compatibility prompts shown during onboarding and
// on Connect cards, so a match is backed by real conversation hooks and not
// just a vibe percentage.
export const PROMPT_BANK: PromptDef[] = [
  { id: "sunday", text: "My ideal Sunday looks like..." },
  { id: "unpopular_opinion", text: "Unpopular opinion:" },
  { id: "two_truths", text: "Two truths and a lie:" },
  { id: "comfort_food", text: "My go-to comfort food is..." },
  { id: "chai_or_coffee", text: "Chai or coffee, and why:" },
  { id: "dream_trip", text: "Dream trip I haven't taken yet:" },
  { id: "green_flag", text: "A green flag I look for:" },
  { id: "playlist", text: "The song stuck in my head lately:" },
  { id: "hot_take_movies", text: "My hot take on Bollywood vs Hollywood:" },
  { id: "weekend_plan", text: "You'll usually find me on weekends..." },
  { id: "life_goal", text: "Something I'm working towards:" },
  { id: "convince_me", text: "Convince me to try your favorite hobby:" },
];

export const PROMPT_COUNT = 3;

export function promptText(promptId: string): string {
  return PROMPT_BANK.find((p) => p.id === promptId)?.text ?? "";
}
