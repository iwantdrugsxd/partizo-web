"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { Outing, UserProfile } from "@/lib/types";
import { computeVibeScore } from "@/lib/vibe";
import OutingCard from "@/components/OutingCard";

type Tab = "live" | "mine";

export default function OutingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("live");
  const [liveOutings, setLiveOutings] = useState<Outing[] | null>(null);
  const [myOutings, setMyOutings] = useState<Outing[] | null>(null);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});

  async function load() {
    if (!user) return;
    const [live, mine] = await Promise.all([
      dataProvider.getLiveOutings(user.uid),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const list = tab === "live" ? liveOutings : myOutings;

  return (
    <div className="px-5 pt-6">
      <h1 className="mb-4 font-display text-2xl font-extrabold text-gradient">Outings Live</h1>

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

      {list === null ? (
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
