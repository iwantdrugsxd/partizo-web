"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { dataProvider, DeckCandidate } from "@/lib/data";
import { DeckFilters } from "@/lib/data/provider";
import SwipeCard from "@/components/SwipeCard";
import ProfileDetailModal from "@/components/ProfileDetailModal";
import DeckFilterSheet from "@/components/DeckFilterSheet";
import LikedByGrid from "@/components/LikedByGrid";
import { IconFilter, IconHeart, IconUndo, IconX } from "@/components/icons";

type Tab = "discover" | "likedYou";

function countActiveFilters(f: DeckFilters): number {
  let n = 0;
  if (f.minVibeScore) n++;
  if (f.minAge !== undefined && f.minAge > 18) n++;
  if (f.maxAge !== undefined && f.maxAge < 60) n++;
  if (f.requiredTags?.length) n++;
  if (f.maxDistanceKm) n++;
  return n;
}

export default function SwipeDeck() {
  const { user } = useAuth();
  const [deck, setDeck] = useState<DeckCandidate[] | null>(null);
  const [matchInfo, setMatchInfo] = useState<{ candidate: DeckCandidate; chatId: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [expanded, setExpanded] = useState<DeckCandidate | null>(null);
  const [filters, setFilters] = useState<DeckFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("discover");
  const [likedBy, setLikedBy] = useState<DeckCandidate[] | null>(null);

  useEffect(() => {
    if (!user) return;
    dataProvider.getDeck(user.uid, filters).then(setDeck);
  }, [user, filters]);

  function refreshLikedBy() {
    if (!user) return;
    dataProvider.getLikedByUsers(user.uid).then(setLikedBy);
  }

  useEffect(() => {
    refreshLikedBy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSwipe(direction: "like" | "pass") {
    if (!user || !deck || deck.length === 0) return;
    const candidate = deck[0];
    setDeck((d) => (d ? d.slice(1) : d));
    setCanUndo(true);
    const result = await dataProvider.recordSwipe(user.uid, candidate.uid, direction);
    if (result.matched && result.match) {
      setMatchInfo({ candidate, chatId: result.match.chatId });
    }
    refreshLikedBy();
  }

  async function handleGridSwipe(candidate: DeckCandidate, direction: "like" | "pass") {
    if (!user) return;
    setLikedBy((list) => (list ? list.filter((c) => c.uid !== candidate.uid) : list));
    const result = await dataProvider.recordSwipe(user.uid, candidate.uid, direction);
    if (result.matched && result.match) {
      setMatchInfo({ candidate, chatId: result.match.chatId });
    }
  }

  async function handleUndo() {
    if (!user || undoing) return;
    setUndoing(true);
    try {
      const restored = await dataProvider.undoLastSwipe(user.uid);
      if (restored) {
        setDeck((d) => (d ? [restored, ...d] : [restored]));
        setMatchInfo((m) => (m && m.candidate.uid === restored.uid ? null : m));
      }
      setCanUndo(false);
    } finally {
      setUndoing(false);
    }
  }

  if (!user || deck === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div className="flex h-full flex-col px-5 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-gradient">Connect</h1>
        {tab === "discover" && (
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filter deck"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5"
          >
            <IconFilter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-vibe-gradient text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2 rounded-full bg-white/5 p-1">
        {(["discover", "likedYou"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === t ? "text-white" : "text-white/40"
            }`}
          >
            {tab === t && (
              <motion.div layoutId="connect-tab" className="absolute inset-0 rounded-full bg-vibe-gradient" />
            )}
            <span className="relative z-10">
              {t === "discover" ? "Discover" : `Liked you${likedBy?.length ? ` (${likedBy.length})` : ""}`}
            </span>
          </button>
        ))}
      </div>

      {tab === "likedYou" ? (
        <LikedByGrid candidates={likedBy} onView={setExpanded} onSwipe={handleGridSwipe} />
      ) : (
        <>
      <div className="relative mb-6 flex-1">
        {deck.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-5xl">🌊</div>
            <p className="font-display text-lg font-semibold">
              {activeFilterCount > 0 ? "No one matches these filters" : "You've seen everyone nearby"}
            </p>
            <p className="mt-1 text-sm text-white/50">
              {activeFilterCount > 0
                ? "Try loosening your filters to see more people."
                : "Check back soon, or plan an outing to meet people directly."}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({})}
                className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {deck
              .slice(0, 3)
              .map((c, i) => (
                <SwipeCard
                  key={c.uid}
                  candidate={c}
                  isTop={i === 0}
                  index={i}
                  onSwipe={handleSwipe}
                  onExpand={() => setExpanded(c)}
                />
              ))
              .reverse()}
          </AnimatePresence>
        )}
      </div>

      {(deck.length > 0 || canUndo) && (
        <div className="mb-6 flex items-center justify-center gap-5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleUndo}
            disabled={!canUndo || undoing}
            aria-label="Undo last swipe"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-vibe-orange disabled:opacity-30"
          >
            <IconUndo className="h-5 w-5" />
          </motion.button>
          {deck.length > 0 && (
            <>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleSwipe("pass")}
                aria-label="Pass"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-red-400"
              >
                <IconX className="h-6 w-6" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => handleSwipe("like")}
                aria-label="Like"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-vibe-gradient shadow-glow"
              >
                <IconHeart className="h-7 w-7" />
              </motion.button>
            </>
          )}
        </div>
      )}
        </>
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
              <p className="mb-2 font-display text-4xl font-extrabold text-gradient">It&apos;s a Vibe!</p>
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

      <ProfileDetailModal candidate={expanded} me={user} onClose={() => setExpanded(null)} />
      <DeckFilterSheet
        open={filterOpen}
        initial={filters}
        onApply={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
