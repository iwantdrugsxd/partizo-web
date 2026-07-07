"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { VIBE_TAGS } from "@/data/tags";
import { IconX } from "@/components/icons";

const CATEGORIES = [
  "Food crawl",
  "Trek / Outdoors",
  "Gig / Live music",
  "Sports & fitness",
  "Coffee & chill",
  "Party / Nightlife",
  "Gaming",
  "Learning & workshops",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateOutingModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [minVibeScore, setMinVibeScore] = useState(40);
  const [vibeTags, setVibeTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setVibeTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : t.length < 5 ? [...t, tag] : t));
  }

  function reset() {
    setTitle("");
    setCategory(CATEGORIES[0]);
    setDescription("");
    setLocation("");
    setDateTime("");
    setCapacity(4);
    setMinVibeScore(40);
    setVibeTags([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const outing = await dataProvider.createOuting({
        leaderId: user.uid,
        title,
        category,
        description,
        location,
        dateTime: dateTime ? new Date(dateTime).getTime() : Date.now() + 3600_000,
        capacity,
        minVibeScore,
        vibeTags,
      });
      reset();
      onClose();
      router.push(`/outings/${outing.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-vibe-card p-6 pb-10"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Plan an outing</h2>
              <button onClick={onClose} className="rounded-full bg-white/5 p-2">
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sunset trek + street food crawl"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        category === c ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What's the plan?"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/50">Location</label>
                  <input
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Indiranagar, Bengaluru"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/50">Date & time</label>
                  <input
                    type="datetime-local"
                    required
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-xs font-medium text-white/50">Capacity</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">
                  Minimum vibe score to request: {minVibeScore}%
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

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Vibe tags (up to 5)</label>
                <div className="flex flex-wrap gap-2">
                  {VIBE_TAGS.slice(0, 16).map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        vibeTags.includes(tag) ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Go live with this outing"}
              </motion.button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
