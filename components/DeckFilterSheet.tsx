"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VIBE_TAGS } from "@/data/tags";
import { DeckFilters } from "@/lib/data/provider";
import { IconX } from "@/components/icons";

interface Props {
  open: boolean;
  initial: DeckFilters;
  onApply: (filters: DeckFilters) => void;
  onClose: () => void;
}

export default function DeckFilterSheet({ open, initial, onApply, onClose }: Props) {
  const [minVibeScore, setMinVibeScore] = useState(initial.minVibeScore ?? 0);
  const [minAge, setMinAge] = useState(initial.minAge ?? 18);
  const [maxAge, setMaxAge] = useState(initial.maxAge ?? 60);
  const [requiredTags, setRequiredTags] = useState<string[]>(initial.requiredTags ?? []);
  const [maxDistanceKm, setMaxDistanceKm] = useState(initial.maxDistanceKm ?? 0);

  function toggleTag(tag: string) {
    setRequiredTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function reset() {
    setMinVibeScore(0);
    setMinAge(18);
    setMaxAge(60);
    setRequiredTags([]);
    setMaxDistanceKm(0);
  }

  function apply() {
    onApply({
      minVibeScore: minVibeScore > 0 ? minVibeScore : undefined,
      minAge,
      maxAge,
      requiredTags: requiredTags.length ? requiredTags : undefined,
      maxDistanceKm: maxDistanceKm > 0 ? maxDistanceKm : undefined,
    });
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="no-scrollbar max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-vibe-card p-5 sm:rounded-3xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Filter deck</h2>
              <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-white/50">
                Minimum vibe score: {minVibeScore > 0 ? `${minVibeScore}%` : "Any"}
              </label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minVibeScore}
                onChange={(e) => setMinVibeScore(Number(e.target.value))}
                className="w-full accent-vibe-coral"
              />
            </div>

            <div className="mb-6 flex gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-white/50">Min age</label>
                <input
                  type="number"
                  min={18}
                  max={maxAge}
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-white/50">Max age</label>
                <input
                  type="number"
                  min={minAge}
                  max={70}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-white/50">
                Max distance: {maxDistanceKm > 0 ? `${maxDistanceKm} km` : "Any"}
              </label>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                className="w-full accent-vibe-coral"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-medium text-white/50">
                Must share at least one of these tags
              </label>
              <div className="flex flex-wrap gap-2">
                {VIBE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      requiredTags.includes(tag)
                        ? "border-transparent bg-vibe-gradient text-white"
                        : "border-white/15 bg-white/5 text-white/70"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 rounded-xl border border-white/15 py-3 text-sm font-semibold">
                Reset
              </button>
              <button onClick={apply} className="flex-1 rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow">
                Apply
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
