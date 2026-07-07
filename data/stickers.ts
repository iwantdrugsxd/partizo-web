// Bundled sticker pack - big emoji "stickers" so chat gets expressive reactions
// without depending on an external GIF/sticker API or network fetch.
export interface StickerDef {
  id: string;
  emoji: string;
  label: string;
}

export const STICKER_PACK: StickerDef[] = [
  { id: "chai", emoji: "☕", label: "Chai time" },
  { id: "cricket", emoji: "🏏", label: "Cricket!" },
  { id: "fire", emoji: "🔥", label: "On fire" },
  { id: "laugh", emoji: "😂", label: "Dying laughing" },
  { id: "biryani", emoji: "🍛", label: "Biryani o'clock" },
  { id: "dance", emoji: "💃", label: "Let's dance" },
  { id: "heart_hands", emoji: "🫶", label: "Love it" },
  { id: "trek", emoji: "🥾", label: "Let's trek" },
  { id: "party", emoji: "🎉", label: "Party time" },
  { id: "thumbs_up", emoji: "👍", label: "Deal" },
  { id: "diya", emoji: "🪔", label: "Diya" },
  { id: "sun", emoji: "🌞", label: "Sunny mood" },
];

export function stickerById(id: string): StickerDef | undefined {
  return STICKER_PACK.find((s) => s.id === id);
}
