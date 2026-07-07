"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { dataProvider, DeckCandidate } from "@/lib/data";
import SwipeCard from "@/components/SwipeCard";
import { IconHeart, IconX } from "@/components/icons";

export default function SwipeDeck() {
  const { user } = useAuth();
  const [deck, setDeck] = useState<DeckCandidate[] | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ candidate: DeckCandidate; chatId: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    dataProvider.getDeck(user.uid).then(setDeck);
  }, [user]);

  async function handleSwipe(direction: "like" | "pass") {
    if (!user || !deck || deck.length === 0) return;
    const candidate = deck[0];
    setDeck((d) => (d ? d.slice(1) : d));
    const result = await dataProvider.recordSwipe(user.uid, candidate.uid, direction);
    if (result.matched && result.match) {
      setMatchInfo({ candidate, chatId: result.match.chatId });
    }
  }

  if (!user || deck === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-5 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-gradient">Connect</h1>
      </div>

      <div className="relative mb-6 flex-1">
        {deck.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl">🌊</div>
            <p className="font-display text-lg font-semibold">You've seen everyone nearby</p>
            <p className="mt-1 text-sm text-white/50">Check back soon, or plan an outing to meet people directly.</p>
          </div>
        ) : (
          <AnimatePresence>
            {deck
              .slice(0, 3)
              .map((c, i) => (
                <SwipeCard key={c.uid} candidate={c} isTop={i === 0} index={i} onSwipe={handleSwipe} />
              ))
              .reverse()}
          </AnimatePresence>
        )}
      </div>

      {deck.length > 0 && (
        <div className="mb-6 flex items-center justify-center gap-6">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe("pass")}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-red-400"
          >
            <IconX className="h-6 w-6" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe("like")}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-vibe-gradient shadow-glow"
          >
            <IconHeart className="h-7 w-7" />
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {matchInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-8 text-center backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
            >
              <p className="mb-2 font-display text-4xl font-extrabold text-gradient">It's a Vibe!</p>
              <div className="relative mx-auto my-6 h-28 w-28 overflow-hidden rounded-full border-4 border-vibe-coral shadow-glow">
                {matchInfo.candidate.photos[0] && (
                  <Image src={matchInfo.candidate.photos[0]} alt="" fill className="object-cover" unoptimized />
                )}
              </div>
              <p className="mb-8 text-white/70">
                You and {matchInfo.candidate.name} vibe at {matchInfo.candidate.vibeScore}%
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/chats/${matchInfo.chatId}`}
                  onClick={() => setMatchInfo(null)}
                  className="rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow"
                >
                  Say hi
                </Link>
                <button onClick={() => setMatchInfo(null)} className="text-sm text-white/50">
                  Keep exploring
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
