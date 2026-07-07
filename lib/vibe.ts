import { QuizAnswer, TraitKey, TraitVector, UserProfile } from "@/lib/types";
import { VIBE_QUIZ } from "@/data/quiz";

const TRAIT_KEYS: TraitKey[] = ["extraversion", "adventure", "humor", "depth", "spontaneity"];

const EMPTY_TRAITS: TraitVector = {
  extraversion: 5,
  adventure: 5,
  humor: 5,
  depth: 5,
  spontaneity: 5,
};

/** Turns raw quiz answers into a normalized 0-10 trait vector. */
export function computeTraitsFromAnswers(answers: QuizAnswer[]): TraitVector {
  const raw: Record<TraitKey, number> = {
    extraversion: 0,
    adventure: 0,
    humor: 0,
    depth: 0,
    spontaneity: 0,
  };

  for (const answer of answers) {
    const question = VIBE_QUIZ.find((q) => q.id === answer.questionId);
    const choice = question?.choices[answer.choiceIndex];
    if (!choice) continue;
    for (const key of TRAIT_KEYS) {
      raw[key] += choice.traits[key] ?? 0;
    }
  }

  // Normalize: max possible per trait across the quiz is small, so we clamp
  // to a friendly 0-10 band centered around 5.
  const normalized: TraitVector = { ...EMPTY_TRAITS };
  for (const key of TRAIT_KEYS) {
    normalized[key] = Math.max(0, Math.min(10, 5 + raw[key] * 1.1));
  }
  return normalized;
}

export function personalityLabel(traits: TraitVector): string {
  const primary = TRAIT_KEYS.reduce((a, b) => (traits[a] >= traits[b] ? a : b));
  const secondary = TRAIT_KEYS.filter((k) => k !== primary).reduce((a, b) =>
    traits[a] >= traits[b] ? a : b
  );

  const label: Record<TraitKey, string> = {
    extraversion: "Extrovert",
    adventure: "Adventurer",
    humor: "Comedian",
    depth: "Deep Thinker",
    spontaneity: "Free Spirit",
  };

  const modifier: Record<TraitKey, string> = {
    extraversion: "Social",
    adventure: "Adventurous",
    humor: "Witty",
    depth: "Thoughtful",
    spontaneity: "Spontaneous",
  };

  return `${modifier[secondary]} ${label[primary]}`;
}

function cosineSimilarity(a: TraitVector, b: TraitVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of TRAIT_KEYS) {
    dot += a[key] * b[key];
    magA += a[key] ** 2;
    magB += b[key] ** 2;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function tagOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Hybrid vibe score (0-100) between two users:
 * 60% personality-trait cosine similarity + 40% interest-tag overlap (Jaccard).
 */
export function computeVibeScore(
  a: Pick<UserProfile, "traits" | "tags">,
  b: Pick<UserProfile, "traits" | "tags">
): number {
  const traitSim = cosineSimilarity(a.traits, b.traits); // 0-1
  const tagSim = tagOverlap(a.tags, b.tags); // 0-1
  const score = traitSim * 0.6 + tagSim * 0.4;
  return Math.round(score * 100);
}

export function sharedTags(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t));
}
