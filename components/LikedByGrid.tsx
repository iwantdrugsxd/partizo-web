"use client";

import Image from "next/image";
import { DeckCandidate } from "@/lib/data";
import { IconHeart, IconX } from "@/components/icons";

interface Props {
  candidates: DeckCandidate[] | null;
  onView: (c: DeckCandidate) => void;
  onSwipe: (candidate: DeckCandidate, direction: "like" | "pass") => void;
}

export default function LikedByGrid({ candidates, onView, onSwipe }: Props) {
  if (candidates === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 text-5xl">👀</div>
        <p className="font-display text-lg font-semibold">No admirers yet</p>
        <p className="mt-1 text-sm text-white/50">Keep swiping - people who like you will show up here.</p>
      </div>
    );
  }

  return (
    <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto pb-4">
      {candidates.map((c) => (
        <div key={c.uid} className="overflow-hidden rounded-2xl border border-white/10 bg-vibe-card">
          <button type="button" onClick={() => onView(c)} className="relative block aspect-[3/4] w-full">
            {c.photos[0] && <Image src={c.photos[0]} alt={c.name} fill className="object-cover" unoptimized />}
            <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 backdrop-blur-md">
              <span className="font-display text-xs font-bold text-gradient">{c.vibeScore}%</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6 text-left">
              <p className="text-sm font-bold">
                {c.name} <span className="font-normal text-white/70">{c.age}</span>
              </p>
            </div>
          </button>
          <div className="flex gap-1.5 p-1.5">
            <button
              onClick={() => onSwipe(c, "pass")}
              aria-label={`Pass on ${c.name}`}
              className="flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 py-2 text-red-400"
            >
              <IconX className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSwipe(c, "like")}
              aria-label={`Like ${c.name} back`}
              className="flex flex-1 items-center justify-center rounded-xl bg-vibe-gradient py-2"
            >
              <IconHeart className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
