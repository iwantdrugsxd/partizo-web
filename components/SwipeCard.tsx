"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { DeckCandidate } from "@/lib/data";
import { promptText } from "@/data/prompts";
import { IconInfo, IconMapPin } from "@/components/icons";

interface Props {
  candidate: DeckCandidate;
  onSwipe: (direction: "like" | "pass") => void;
  onExpand: () => void;
  isTop: boolean;
  index: number;
}

export default function SwipeCard({ candidate, onSwipe, onExpand, isTop, index }: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -20], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120) {
      onSwipe("like");
    } else if (info.offset.x < -120) {
      onSwipe("pass");
    }
  }

  const photo = candidate.photos[photoIndex] ?? candidate.photos[0];
  const firstPrompt = candidate.prompts?.find((p) => p.answer.trim());

  return (
    <motion.div
      className="absolute inset-0"
      style={
        isTop
          ? { x, rotate }
          : { scale: 1 - index * 0.04, y: index * 10, opacity: index < 2 ? 1 - index * 0.25 : 0 }
      }
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={isTop ? { scale: 0.9, opacity: 0 } : false}
      animate={isTop ? { scale: 1, opacity: 1 } : undefined}
      exit={{ x: x.get() > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-vibe-card shadow-card">
        {photo && (
          <button
            type="button"
            onClick={() => setPhotoIndex((i) => (i + 1) % candidate.photos.length)}
            className="absolute inset-0"
          >
            <Image src={photo} alt={candidate.name} fill sizes="400px" className="object-cover" unoptimized priority={isTop} />
          </button>
        )}

        {candidate.photos.length > 1 && (
          <div className="absolute inset-x-3 top-3 flex gap-1">
            {candidate.photos.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i === photoIndex ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        )}

        <div className="absolute right-3 top-6 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-md">
          <span className="font-display text-sm font-bold text-gradient">{candidate.vibeScore}% vibe</span>
        </div>

        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute left-6 top-16 rotate-[-12deg] rounded-lg border-4 border-green-400 px-3 py-1 text-xl font-extrabold text-green-400"
            >
              VIBE
            </motion.div>
            <motion.div
              style={{ opacity: passOpacity }}
              className="absolute right-6 top-16 rotate-[12deg] rounded-lg border-4 border-red-400 px-3 py-1 text-xl font-extrabold text-red-400"
            >
              PASS
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 pt-16">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="font-display text-2xl font-bold">{candidate.name}</h3>
              <span className="text-lg text-white/70">{candidate.age}</span>
              {candidate.verified && <span className="text-sm text-vibe-coral">✓ Verified</span>}
            </div>
            <button
              type="button"
              onClick={onExpand}
              aria-label="View full profile"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80"
            >
              <IconInfo className="h-4 w-4" />
            </button>
          </div>
          {candidate.city && (
            <p className="mb-2 flex items-center gap-1 text-xs text-white/60">
              <IconMapPin className="h-3 w-3" /> {candidate.city}
              {candidate.distanceKm !== undefined && ` · ${candidate.distanceKm.toFixed(1)} km away`}
            </p>
          )}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-vibe-orange">
            {candidate.personalityLabel}
          </p>
          {candidate.bio && <p className="mb-3 text-sm text-white/80 line-clamp-2">{candidate.bio}</p>}
          {firstPrompt && (
            <div className="mb-3 rounded-xl border border-white/15 bg-white/10 p-2.5">
              <p className="mb-0.5 text-[10px] font-medium text-white/50">{promptText(firstPrompt.promptId)}</p>
              <p className="text-xs text-white/90 line-clamp-2">{firstPrompt.answer}</p>
            </div>
          )}
          {candidate.sharedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidate.sharedTags.slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
