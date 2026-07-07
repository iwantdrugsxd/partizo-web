"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { motion } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { Outing, UserProfile } from "@/lib/types";
import { IconCheck, IconClock, IconMapPin, IconX } from "@/components/icons";

export default function OutingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [outing, setOuting] = useState<Outing | null>(null);
  const [leader, setLeader] = useState<UserProfile | null>(null);
  const [requesters, setRequesters] = useState<Record<string, UserProfile>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = dataProvider.subscribeOuting(id, setOuting);
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!outing) return;
    dataProvider.getUser(outing.leaderId).then(setLeader);
    const ids = Array.from(new Set(outing.requests.map((r) => r.uid)));
    Promise.all(ids.map((uid) => dataProvider.getUser(uid))).then((profiles) => {
      const map: Record<string, UserProfile> = {};
      profiles.forEach((p) => p && (map[p.uid] = p));
      setRequesters(map);
    });
  }, [outing]);

  if (!outing || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  const isLeader = outing.leaderId === user.uid;
  const myRequest = outing.requests.find((r) => r.uid === user.uid);
  const isMember = outing.memberIds.includes(user.uid);
  const isFull = outing.memberIds.length >= outing.capacity;

  async function requestJoin() {
    setBusy(true);
    try {
      await dataProvider.requestToJoin(outing!.id, user!.uid);
    } finally {
      setBusy(false);
    }
  }

  async function respond(targetUid: string, accept: boolean) {
    setBusy(true);
    try {
      await dataProvider.respondToRequest(outing!.id, targetUid, accept);
    } finally {
      setBusy(false);
    }
  }

  const pending = outing.requests.filter((r) => r.status === "pending");
  const decided = outing.requests.filter((r) => r.status !== "pending");

  return (
    <div className="px-5 pt-6 pb-10">
      <button onClick={() => router.back()} className="mb-4 text-sm text-white/50">
        ← Back
      </button>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-vibe-orange">{outing.category}</p>
      <h1 className="mb-3 font-display text-2xl font-extrabold">{outing.title}</h1>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-vibe-card/70 p-3">
        {leader?.photos[0] && (
          <div className="relative h-11 w-11 overflow-hidden rounded-full">
            <Image src={leader.photos[0]} alt="" fill className="object-cover" unoptimized />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold">{leader?.name ?? "..."}</p>
          <p className="text-xs text-white/40">Party leader</p>
        </div>
      </div>

      {outing.description && <p className="mb-4 text-sm text-white/70">{outing.description}</p>}

      <div className="mb-4 space-y-2 text-sm text-white/60">
        <p className="flex items-center gap-2">
          <IconMapPin className="h-4 w-4" /> {outing.location}
        </p>
        <p className="flex items-center gap-2">
          <IconClock className="h-4 w-4" /> {format(new Date(outing.dateTime), "eeee d MMM, h:mm a")}
        </p>
        <p>
          {outing.memberIds.length}/{outing.capacity} going · min vibe {outing.minVibeScore}%
        </p>
      </div>

      {outing.vibeTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {outing.vibeTags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {!isLeader && (
        <div className="mb-8">
          {isMember ? (
            <button
              onClick={() => outing.chatId && router.push(`/chats/${outing.chatId}`)}
              className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow"
            >
              Open group chat
            </button>
          ) : myRequest ? (
            <div className="rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm text-white/60">
              {myRequest.status === "pending" && "Request sent - waiting on the party leader"}
              {myRequest.status === "rejected" && "Your request wasn't accepted this time"}
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={requestJoin}
              disabled={busy || isFull}
              className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-40"
            >
              {isFull ? "Outing full" : "Request to join"}
            </motion.button>
          )}
        </div>
      )}

      {isLeader && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">
            Requests {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 && (
            <p className="mb-4 text-sm text-white/40">No pending requests yet.</p>
          )}
          <div className="space-y-3">
            {pending.map((r) => {
              const p = requesters[r.uid];
              return (
                <div
                  key={r.uid}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-vibe-card/70 p-3"
                >
                  <div className="flex items-center gap-3">
                    {p?.photos[0] && (
                      <div className="relative h-10 w-10 overflow-hidden rounded-full">
                        <Image src={p.photos[0]} alt="" fill className="object-cover" unoptimized />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{p?.name ?? "..."}</p>
                      <p className="text-xs text-white/40">{p?.personalityLabel}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => respond(r.uid, false)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-red-400"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => respond(r.uid, true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-vibe-gradient"
                    >
                      <IconCheck className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {decided.filter((d) => d.status === "accepted").length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-white/60">Going</h3>
              <div className="flex flex-wrap gap-2">
                {decided
                  .filter((d) => d.status === "accepted")
                  .map((d) => (
                    <span key={d.uid} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                      {requesters[d.uid]?.name ?? "..."}
                    </span>
                  ))}
              </div>
            </>
          )}

          {outing.chatId && (
            <button
              onClick={() => router.push(`/chats/${outing.chatId}`)}
              className="mt-6 w-full rounded-xl border border-white/15 py-3 text-sm font-semibold"
            >
              Open group chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
