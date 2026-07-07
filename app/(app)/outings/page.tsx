"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { Outing, UserProfile } from "@/lib/types";
import { computeVibeScore } from "@/lib/vibe";
import OutingCard from "@/components/OutingCard";
import OutingMapView from "@/components/OutingMapView";
import { IconMapPin } from "@/components/icons";

type Tab = "live" | "mine";
type ViewMode = "list" | "map";

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

export default function OutingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("live");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [liveOutings, setLiveOutings] = useState<Outing[] | null>(null);
  const [myOutings, setMyOutings] = useState<Outing[] | null>(null);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    if (!user) return;
    const [live, mine] = await Promise.all([
      dataProvider.getLiveOutings(user.uid, {
        query: query || undefined,
        category: category || undefined,
      }),
      dataProvider.getMyOutings(user.uid),
    ]);
    setLiveOutings(live);
    setMyOutings(mine);
    const leaderIds = Array.from(new Set([...live, ...mine].map((o) => o.leaderId)));
    const profiles = await Promise.all(leaderIds.map((id) => dataProvider.getUser(id)));
    const map: Record<string, UserProfile> = {};
    profiles.forEach((p) => {
      if (p) map[p.uid] = p;
    });
    setUsers(map);
  }

  useEffect(() => {
    load();
    if (user) dataProvider.checkOutingReminders(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, query, category]);

  const list = tab === "live" ? liveOutings : myOutings;

  return (
    <div className="px-5 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-gradient">Outings Live</h1>
        {tab === "live" && (
          <button
            onClick={() => setViewMode((v) => (v === "list" ? "map" : "list"))}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium"
          >
            <IconMapPin className="h-3.5 w-3.5" />
            {viewMode === "list" ? "Map" : "List"}
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-2 rounded-full bg-white/5 p-1">
        {(["live", "mine"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              tab === t ? "text-white" : "text-white/40"
            }`}
          >
            {tab === t && (
              <motion.div layoutId="outing-tab" className="absolute inset-0 rounded-full bg-vibe-gradient" />
            )}
            <span className="relative z-10">{t === "live" ? "Live near you" : "My outings"}</span>
          </button>
        ))}
      </div>

      {tab === "live" && (
        <div className="mb-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outings..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-vibe-coral"
            />
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                category ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
              }`}
            >
              {category || "Category"}
            </button>
          </div>
          {filtersOpen && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <button
                onClick={() => {
                  setCategory("");
                  setFiltersOpen(false);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs ${!category ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"}`}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategory(c);
                    setFiltersOpen(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs ${category === c ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "live" && viewMode === "map" && liveOutings && liveOutings.length > 0 ? (
        <OutingMapView outings={liveOutings} />
      ) : list === null ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-sm text-white/40">
          {tab === "live"
            ? "No live outings right now. Be the first - tap the + button to start one."
            : "You haven't created or joined an outing yet."}
        </div>
      ) : (
        list.map((o) => (
          <OutingCard
            key={o.id}
            outing={o}
            leaderName={users[o.leaderId]?.name}
            vibeScore={
              user && users[o.leaderId] && o.leaderId !== user.uid
                ? computeVibeScore(user, users[o.leaderId])
                : undefined
            }
          />
        ))
      )}
    </div>
  );
}
