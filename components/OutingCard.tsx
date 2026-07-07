"use client";

import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Outing } from "@/lib/types";
import { IconMapPin, IconClock } from "@/components/icons";

interface Props {
  outing: Outing;
  leaderName?: string;
  vibeScore?: number;
}

export default function OutingCard({ outing, leaderName, vibeScore }: Props) {
  const guestSeats = outing.requests
    .filter((r) => r.status === "accepted" && outing.memberIds.includes(r.uid))
    .reduce((sum, r) => sum + (r.guestCount ?? 0), 0);
  const spotsLeft = outing.capacity - outing.memberIds.length - guestSeats;

  return (
    <Link href={`/outings/${outing.id}`}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="mb-3 rounded-2xl border border-white/10 bg-vibe-card/80 p-4"
      >
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-vibe-orange">
              {outing.category}
            </p>
            <h3 className="font-display text-base font-bold">{outing.title}</h3>
          </div>
          {vibeScore !== undefined && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-gradient">
              {vibeScore}% vibe
            </span>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <IconMapPin className="h-3.5 w-3.5" /> {outing.location}
          </span>
          <span className="flex items-center gap-1">
            <IconClock className="h-3.5 w-3.5" /> {format(new Date(outing.dateTime), "d MMM, h:mm a")}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">
            {leaderName ? `Hosted by ${leaderName} · ` : ""}
            {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : "Full"}
          </p>
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
              outing.status === "live" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"
            }`}
          >
            {outing.status === "live" ? "LIVE" : outing.status.toUpperCase()}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
