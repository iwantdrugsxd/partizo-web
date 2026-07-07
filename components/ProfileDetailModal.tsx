"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { DeckCandidate } from "@/lib/data";
import { UserProfile } from "@/lib/types";
import { promptText } from "@/data/prompts";
import { IconMapPin, IconX } from "@/components/icons";
import RadarChart from "@/components/RadarChart";

interface Props {
  candidate: DeckCandidate | null;
  me?: UserProfile | null;
  onClose: () => void;
}

const TRAIT_LABELS: { key: keyof DeckCandidate["traits"]; label: string }[] = [
  { key: "extraversion", label: "Extraversion" },
  { key: "adventure", label: "Adventure" },
  { key: "humor", label: "Humor" },
  { key: "depth", label: "Depth" },
  { key: "spontaneity", label: "Spontaneity" },
];

export default function ProfileDetailModal({ candidate, me, onClose }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <AnimatePresence>
      {candidate && (
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
            className="no-scrollbar max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-vibe-card sm:rounded-3xl"
          >
            <div className="relative aspect-[4/5] w-full">
              {candidate.photos[photoIndex] && (
                <Image
                  src={candidate.photos[photoIndex]}
                  alt={candidate.name}
                  fill
                  sizes="500px"
                  className="object-cover"
                  unoptimized
                />
              )}
              {candidate.photos.length > 1 && (
                <div className="absolute inset-x-3 top-3 flex gap-1">
                  {candidate.photos.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      className={`h-1 flex-1 rounded-full ${i === photoIndex ? "bg-white" : "bg-white/30"}`}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-9 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 backdrop-blur-md"
              >
                <IconX className="h-4 w-4" />
              </button>
              <div className="absolute right-3 top-20 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
                <span className="font-display text-sm font-bold text-gradient">{candidate.vibeScore}% vibe</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-vibe-card via-vibe-card/60 to-transparent p-5 pt-16">
                <div className="mb-1 flex items-baseline gap-2">
                  <h3 className="font-display text-2xl font-bold">{candidate.name}</h3>
                  <span className="text-lg text-white/70">{candidate.age}</span>
                  {candidate.verified && <span className="text-sm text-vibe-coral">✓ Verified</span>}
                </div>
                {candidate.city && (
                  <p className="flex items-center gap-1 text-xs text-white/60">
                    <IconMapPin className="h-3 w-3" /> {candidate.city}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-vibe-orange">
                  {candidate.personalityLabel}
                </p>
                {candidate.bio && <p className="text-sm text-white/80">{candidate.bio}</p>}
              </div>

              {candidate.prompts?.filter((p) => p.answer.trim()).length > 0 && (
                <div className="space-y-3">
                  {candidate.prompts
                    .filter((p) => p.answer.trim())
                    .map((p) => (
                      <div key={p.promptId} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="mb-1 text-xs font-medium text-white/50">{promptText(p.promptId)}</p>
                        <p className="text-sm text-white/90">{p.answer}</p>
                      </div>
                    ))}
                </div>
              )}

              {candidate.tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-white/50">Vibe tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          candidate.sharedTags.includes(tag) ? "bg-vibe-gradient text-white" : "bg-white/10 text-white/70"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium text-white/50">
                  {me ? "Personality breakdown vs. you" : "Personality breakdown"}
                </p>
                {me ? (
                  <div className="flex justify-center">
                    <RadarChart me={me.traits} them={candidate.traits} labels={TRAIT_LABELS} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {TRAIT_LABELS.map(({ key, label }) => (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-white/50">
                          <span>{label}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-vibe-gradient"
                            style={{ width: `${(candidate.traits[key] / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
