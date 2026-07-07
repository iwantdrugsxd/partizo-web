"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { LiveLocationShare, Outing, SafetyCheckin, UserProfile } from "@/lib/types";
import { downloadICS, googleCalendarUrl } from "@/lib/calendar";
import { coordsForCity } from "@/lib/geo";
import LiveLocationMap from "@/components/LiveLocationMap";
import { IconCalendar, IconCheck, IconClock, IconMapPin, IconShield, IconStar, IconX } from "@/components/icons";

export default function OutingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [outing, setOuting] = useState<Outing | null>(null);
  const [leader, setLeader] = useState<UserProfile | null>(null);
  const [requesters, setRequesters] = useState<Record<string, UserProfile>>({});
  const [busy, setBusy] = useState(false);
  const [checkin, setCheckin] = useState<SafetyCheckin | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [attendees, setAttendees] = useState<UserProfile[] | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [reconnectBusy, setReconnectBusy] = useState(false);
  const [reconnectMatchCount, setReconnectMatchCount] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDateTime, setNewDateTime] = useState("");
  const [reputation, setReputation] = useState<{ avgVenueRating: number; avgVibeRating: number; ratingCount: number } | null>(null);
  const [myRating, setMyRating] = useState({ venueRating: 0, vibeRating: 0 });
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [liveShareOpen, setLiveShareOpen] = useState(false);
  const [liveShareBusy, setLiveShareBusy] = useState(false);
  const [liveShareError, setLiveShareError] = useState("");
  const [myShare, setMyShare] = useState<LiveLocationShare | null>(null);
  const [memberShares, setMemberShares] = useState<Record<string, LiveLocationShare | null>>({});
  const watchIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!outing || !user || !outing.memberIds.includes(user.uid)) return;
    dataProvider.getSafetyCheckin(outing.id, user.uid).then(setCheckin);
  }, [outing, user]);

  useEffect(() => {
    if (!outing || !user) return;
    if (outing.status !== "completed" || !outing.memberIds.includes(user.uid)) return;
    if (outing.reconnectSubmittedUids.includes(user.uid)) return;
    dataProvider.getOutingAttendees(outing.id, user.uid).then(setAttendees);
  }, [outing, user]);

  useEffect(() => {
    if (!outing) return;
    dataProvider.getLeaderReputation(outing.leaderId).then(setReputation);
  }, [outing]);

  useEffect(() => {
    if (!outing || !user) return;
    dataProvider.getOutingRatings(outing.id).then((ratings) => {
      if (ratings.some((r) => r.uid === user.uid)) setRatingSubmitted(true);
    });
  }, [outing, user]);

  useEffect(() => {
    if (!outing || !user || !outing.memberIds.includes(user.uid)) return;
    const unsubscribe = dataProvider.subscribeLiveLocation(outing.id, user.uid, setMyShare);
    return unsubscribe;
  }, [outing, user]);

  useEffect(() => {
    if (!outing || !user) return;
    const others = outing.memberIds.filter((id) => id !== user.uid);
    const unsubs = others.map((uid) =>
      dataProvider.subscribeLiveLocation(outing.id, uid, (share) => setMemberShares((m) => ({ ...m, [uid]: share })))
    );
    return () => unsubs.forEach((u) => u());
  }, [outing, user]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  if (!outing || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  const isLeader = outing.leaderId === user.uid;
  const isCoHost = outing.coHostId === user.uid;
  const canManage = isLeader || isCoHost;
  const myRequest = outing.requests.find((r) => r.uid === user.uid);
  const isMember = outing.memberIds.includes(user.uid);
  const isFull = outing.memberIds.length >= outing.capacity;

  async function requestJoin() {
    setBusy(true);
    try {
      await dataProvider.requestToJoin(outing!.id, user!.uid, guestCount);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setBusy(true);
    try {
      await dataProvider.cancelOuting(outing!.id, user!.uid, cancelReason || undefined);
      setCancelOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule() {
    if (!newDateTime) return;
    setBusy(true);
    try {
      await dataProvider.rescheduleOuting(outing!.id, user!.uid, new Date(newDateTime).getTime());
      setRescheduleOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function makeCoHost(uid: string | null) {
    setBusy(true);
    try {
      await dataProvider.setCoHost(outing!.id, user!.uid, uid);
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(url: string) {
    await dataProvider.addOutingPhoto(outing!.id, user!.uid, url);
  }

  async function submitRating() {
    if (myRating.venueRating === 0 || myRating.vibeRating === 0) return;
    setBusy(true);
    try {
      await dataProvider.submitOutingRating(outing!.id, user!.uid, myRating);
      setRatingSubmitted(true);
      dataProvider.getLeaderReputation(outing!.leaderId).then(setReputation);
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

  async function leave() {
    setBusy(true);
    try {
      await dataProvider.leaveOuting(outing!.id, user!.uid);
    } finally {
      setBusy(false);
    }
  }

  async function shareStatus() {
    setCheckinBusy(true);
    try {
      const c = await dataProvider.startSafetyCheckin(outing!.id, user!.uid);
      setCheckin(c);
    } finally {
      setCheckinBusy(false);
    }
  }

  async function markSafe() {
    setCheckinBusy(true);
    try {
      await dataProvider.confirmSafe(outing!.id, user!.uid);
      const c = await dataProvider.getSafetyCheckin(outing!.id, user!.uid);
      setCheckin(c);
    } finally {
      setCheckinBusy(false);
    }
  }

  async function sendSOS() {
    setSosBusy(true);
    try {
      const c = await dataProvider.triggerSOS(outing!.id, user!.uid);
      setCheckin(c);
      setSosSent(true);
    } finally {
      setSosBusy(false);
    }
  }

  function startLiveShare(durationMinutes: number) {
    setLiveShareError("");
    if (!navigator.geolocation) {
      setLiveShareError("Location isn't available on this device.");
      return;
    }
    setLiveShareBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await dataProvider.startLiveLocation(outing!.id, user!.uid, latitude, longitude, durationMinutes);
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => dataProvider.updateLiveLocation(outing!.id, user!.uid, p.coords.latitude, p.coords.longitude),
          () => {},
          { enableHighAccuracy: false }
        );
        setLiveShareOpen(false);
        setLiveShareBusy(false);
      },
      () => {
        setLiveShareError("Location permission was denied - enable it in your browser settings to share.");
        setLiveShareBusy(false);
      }
    );
  }

  async function stopLiveShare() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    await dataProvider.stopLiveLocation(outing!.id, user!.uid);
  }

  function togglePick(uid: string) {
    setPicks((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
  }

  async function submitPicks(picksToSubmit: string[]) {
    setReconnectBusy(true);
    try {
      const matches = await dataProvider.submitReconnectPicks(outing!.id, user!.uid, picksToSubmit);
      setReconnectMatchCount(matches.length);
    } finally {
      setReconnectBusy(false);
    }
  }

  const pending = outing.requests.filter((r) => r.status === "pending");
  const waitlisted = outing.requests.filter((r) => r.status === "waitlisted");
  const decided = outing.requests.filter((r) => r.status !== "pending" && r.status !== "waitlisted");
  const guestSeats = outing.requests
    .filter((r) => r.status === "accepted" && outing.memberIds.includes(r.uid))
    .reduce((sum, r) => sum + (r.guestCount ?? 0), 0);
  const totalGoing = outing.memberIds.length + guestSeats;

  return (
    <div className="px-5 pt-6 pb-10">
      <button onClick={() => router.back()} className="mb-4 text-sm text-white/50">
        ← Back
      </button>

      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-vibe-orange">{outing.category}</p>
        {outing.visibility === "private" && (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
            Private
          </span>
        )}
      </div>
      <h1 className="mb-3 font-display text-2xl font-extrabold">{outing.title}</h1>

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-vibe-card/70 p-3">
        {leader?.photos[0] && (
          <div className="relative h-11 w-11 overflow-hidden rounded-full">
            <Image src={leader.photos[0]} alt="" fill className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">{leader?.name ?? "..."}</p>
          <p className="text-xs text-white/40">
            Party leader
            {reputation && reputation.ratingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-vibe-orange">
                <IconStar className="h-3 w-3" /> {reputation.avgVibeRating.toFixed(1)} ({reputation.ratingCount})
              </span>
            )}
          </p>
        </div>
      </div>

      {outing.description && <p className="mb-4 text-sm text-white/70">{outing.description}</p>}

      <div className="mb-2 space-y-2 text-sm text-white/60">
        <p className="flex items-center gap-2">
          <IconMapPin className="h-4 w-4" /> {outing.location}
        </p>
        <p className="flex items-center gap-2">
          <IconClock className="h-4 w-4" /> {format(new Date(outing.dateTime), "eeee d MMM, h:mm a")}
        </p>
        <p>
          {totalGoing}/{outing.capacity} going · min vibe {outing.minVibeScore}%
          {outing.status === "cancelled" && <span className="ml-2 text-red-400">· Cancelled</span>}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => downloadICS(outing)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60"
        >
          <IconCalendar className="h-3.5 w-3.5" /> Download .ics
        </button>
        <a
          href={googleCalendarUrl(outing)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60"
        >
          <IconCalendar className="h-3.5 w-3.5" /> Add to Google Calendar
        </a>
        {isLeader && outing.status !== "cancelled" && outing.status !== "completed" && (
          <>
            <button
              onClick={() => setRescheduleOpen((v) => !v)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60"
            >
              Reschedule
            </button>
            <button
              onClick={() => setCancelOpen((v) => !v)}
              className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs text-red-400"
            >
              Cancel outing
            </button>
          </>
        )}
      </div>

      {rescheduleOpen && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="mb-1 block text-xs font-medium text-white/50">New date & time</label>
          <input
            type="datetime-local"
            value={newDateTime}
            onChange={(e) => setNewDateTime(e.target.value)}
            className="mb-2 w-full rounded-lg border border-white/10 bg-vibe-card px-3 py-2 text-sm outline-none focus:border-vibe-coral"
          />
          <button
            onClick={confirmReschedule}
            disabled={busy || !newDateTime}
            className="w-full rounded-lg bg-vibe-gradient py-2 text-sm font-semibold disabled:opacity-40"
          >
            Confirm new time
          </button>
        </div>
      )}

      {cancelOpen && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3">
          <label className="mb-1 block text-xs font-medium text-white/50">Reason (optional, shared with the group)</label>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="e.g. Venue fell through"
            className="mb-2 w-full rounded-lg border border-white/10 bg-vibe-card px-3 py-2 text-sm outline-none focus:border-vibe-coral"
          />
          <button
            onClick={confirmCancel}
            disabled={busy}
            className="w-full rounded-lg bg-red-500/80 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Confirm cancellation
          </button>
        </div>
      )}

      {outing.cancelReason && outing.status === "cancelled" && (
        <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">
          Cancelled: {outing.cancelReason}
        </p>
      )}

      {outing.vibeTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {outing.vibeTags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      {isMember && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <IconShield className="h-4 w-4 text-vibe-coral" />
            <h2 className="font-display text-sm font-bold">Safety check-in</h2>
          </div>

          {!checkin && (
            <>
              {user.emergencyContactName && user.emergencyContactPhone ? (
                <>
                  <p className="mb-3 text-xs text-white/50">
                    Share this outing&apos;s details with {user.emergencyContactName} before you head out.
                  </p>
                  <button
                    onClick={shareStatus}
                    disabled={checkinBusy}
                    className="w-full rounded-xl bg-vibe-gradient py-2.5 text-sm font-semibold shadow-glow disabled:opacity-50"
                  >
                    Share outing status
                  </button>
                </>
              ) : (
                <p className="text-xs text-white/50">
                  Add an emergency contact in your{" "}
                  <Link href="/profile" className="font-semibold text-vibe-coral">
                    profile
                  </Link>{" "}
                  so you can share your outing status before meeting someone new.
                </p>
              )}
            </>
          )}

          {checkin?.status === "shared" && (
            <>
              <p className="mb-3 text-xs text-white/60">
                Status shared with {checkin.emergencyContactName ?? "your emergency contact"}. Mark yourself safe once
                you&apos;re done.
              </p>
              <button
                onClick={markSafe}
                disabled={checkinBusy}
                className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                I&apos;m safe
              </button>
            </>
          )}

          {checkin?.status === "overdue" && (
            <>
              <p className="mb-3 text-xs text-red-400">
                You haven&apos;t checked in since the outing started. Mark yourself safe so we don&apos;t alert{" "}
                {checkin.emergencyContactName ?? "your emergency contact"}.
              </p>
              <button
                onClick={markSafe}
                disabled={checkinBusy}
                className="w-full rounded-xl bg-vibe-gradient py-2.5 text-sm font-semibold shadow-glow disabled:opacity-50"
              >
                I&apos;m safe
              </button>
            </>
          )}

          {checkin?.status === "confirmed_safe" && (
            <p className="text-xs text-white/50">✅ You checked in safe. Have a great time!</p>
          )}

          {outing.status !== "cancelled" && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Feeling unsafe?</p>
                  <p className="text-xs text-white/40">Alerts your emergency contact immediately</p>
                </div>
                <button
                  onClick={sendSOS}
                  disabled={sosBusy || sosSent}
                  className="shrink-0 rounded-full bg-red-500 px-4 py-2 text-xs font-bold shadow-glow disabled:opacity-50"
                >
                  {sosSent ? "SOS sent" : "SOS"}
                </button>
              </div>

              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Live location</p>
                  <p className="text-xs text-white/40">
                    {myShare
                      ? `Sharing until ${format(new Date(myShare.expiresAt), "h:mm a")}`
                      : "Share your location with the group for a set time"}
                  </p>
                </div>
                {myShare ? (
                  <button
                    onClick={stopLiveShare}
                    className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={() => setLiveShareOpen((v) => !v)}
                    disabled={liveShareBusy}
                    className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Share
                  </button>
                )}
              </div>

              {liveShareOpen && !myShare && (
                <div className="mb-3 flex gap-2">
                  {[30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => startLiveShare(mins)}
                      disabled={liveShareBusy}
                      className="flex-1 rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              )}
              {liveShareError && <p className="mb-2 text-xs text-red-400">{liveShareError}</p>}

              {(myShare || Object.values(memberShares).some(Boolean)) && (
                <LiveLocationMap
                  center={
                    outing.lat !== undefined && outing.lng !== undefined
                      ? { lat: outing.lat, lng: outing.lng }
                      : coordsForCity(user.city) ?? { lat: 12.9716, lng: 77.5946 }
                  }
                  shares={[
                    ...(myShare ? [{ uid: user.uid, name: "You", lat: myShare.lat, lng: myShare.lng }] : []),
                    ...Object.entries(memberShares)
                      .filter((entry): entry is [string, LiveLocationShare] => Boolean(entry[1]))
                      .map(([uid, share]) => ({
                        uid,
                        name: uid === leader?.uid ? leader?.name ?? "Member" : requesters[uid]?.name ?? "Member",
                        lat: share.lat,
                        lng: share.lng,
                      })),
                  ]}
                />
              )}
            </div>
          )}
        </div>
      )}

      {isMember && outing.status === "completed" && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
          <h2 className="mb-1 font-display text-sm font-bold">Vibe check 🔁</h2>
          {outing.reconnectSubmittedUids.includes(user.uid) ? (
            <p className="text-xs text-white/50">
              {reconnectMatchCount === null
                ? "Picks submitted - we'll let you know if it's mutual!"
                : reconnectMatchCount > 0
                ? `It's mutual! Check your chats - you matched with ${reconnectMatchCount} ${reconnectMatchCount === 1 ? "person" : "people"}.`
                : "Picks submitted - we'll let you know if it's mutual!"}
            </p>
          ) : attendees === null ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
            </div>
          ) : attendees.length === 0 ? (
            <p className="text-xs text-white/40">No one else made it to this one.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-white/50">
                Who did you enjoy meeting? We&apos;ll only tell you if it&apos;s mutual.
              </p>
              <div className="mb-3 space-y-2">
                {attendees.map((a) => (
                  <button
                    key={a.uid}
                    type="button"
                    onClick={() => togglePick(a.uid)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left ${
                      picks.includes(a.uid) ? "border-transparent bg-vibe-gradient" : "border-white/10 bg-white/5"
                    }`}
                  >
                    {a.photos[0] && (
                      <div className="relative h-9 w-9 overflow-hidden rounded-full">
                        <Image src={a.photos[0]} alt="" fill className="object-cover" unoptimized />
                      </div>
                    )}
                    <span className="text-sm font-medium">{a.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => submitPicks(picks)}
                disabled={reconnectBusy || picks.length === 0}
                className="mb-2 w-full rounded-xl bg-vibe-gradient py-2.5 text-sm font-semibold shadow-glow disabled:opacity-40"
              >
                Submit picks
              </button>
              <button
                onClick={() => submitPicks([])}
                disabled={reconnectBusy}
                className="w-full text-center text-xs text-white/40 disabled:opacity-40"
              >
                No one this time
              </button>
            </>
          )}
        </div>
      )}

      {!canManage && outing.status !== "completed" && (
        <div className="mb-8">
          {isMember ? (
            <div className="space-y-2">
              <button
                onClick={() => outing.chatId && router.push(`/chats/${outing.chatId}`)}
                className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow"
              >
                Open group chat
              </button>
              <button
                onClick={leave}
                disabled={busy}
                className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/50 disabled:opacity-40"
              >
                Leave outing
              </button>
            </div>
          ) : myRequest ? (
            <div className="rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm text-white/60">
              {myRequest.status === "pending" && "Request sent - waiting on the party leader"}
              {myRequest.status === "waitlisted" && "You're on the waitlist - we'll notify you if a spot opens up"}
              {myRequest.status === "rejected" && "Your request wasn't accepted this time"}
            </div>
          ) : outing.visibility === "private" && !outing.invitedUserIds.includes(user.uid) ? (
            <div className="rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm text-white/40">
              This is a private outing - only invited people can request to join.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <span className="text-sm text-white/60">Bringing guests?</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGuestCount((g) => Math.max(0, g - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm">{guestCount}</span>
                  <button
                    type="button"
                    onClick={() => setGuestCount((g) => Math.min(5, g + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15"
                  >
                    +
                  </button>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={requestJoin}
                disabled={busy}
                className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-40"
              >
                {isFull ? "Join waitlist" : "Request to join"}
              </motion.button>
            </div>
          )}
        </div>
      )}

      {canManage && (
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
              <div className="space-y-2">
                {decided
                  .filter((d) => d.status === "accepted")
                  .map((d) => (
                    <div key={d.uid} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                      <span className="text-xs">
                        {requesters[d.uid]?.name ?? "..."}
                        {d.guestCount ? ` +${d.guestCount} guest${d.guestCount > 1 ? "s" : ""}` : ""}
                        {outing.coHostId === d.uid && <span className="ml-1.5 text-vibe-orange">· Co-host</span>}
                      </span>
                      {isLeader && (
                        <button
                          onClick={() => makeCoHost(outing.coHostId === d.uid ? null : d.uid)}
                          disabled={busy}
                          className="text-[11px] font-semibold text-vibe-coral disabled:opacity-40"
                        >
                          {outing.coHostId === d.uid ? "Remove co-host" : "Make co-host"}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </>
          )}

          {waitlisted.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold text-white/60">
                Waitlist ({waitlisted.length})
              </h3>
              <p className="mb-2 text-xs text-white/40">
                The outing is full - these people will be added automatically if a spot opens up.
              </p>
              <div className="flex flex-wrap gap-2">
                {waitlisted.map((d) => (
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

      {isMember && (
        <div className="mb-6 mt-6">
          <h2 className="mb-3 font-display text-sm font-bold">Photo album</h2>
          <div className="grid grid-cols-4 gap-2">
            {outing.photoAlbum.map((url, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
                <Image src={url} alt="" fill className="object-cover" unoptimized />
              </div>
            ))}
            {outing.photoAlbum.length < 8 && (
              <div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-white/20">
                <button
                  onClick={() => addPhoto(`https://picsum.photos/seed/${outing.id}-${outing.photoAlbum.length}/300`)}
                  className="flex h-full w-full items-center justify-center text-2xl text-white/40"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isMember && outing.status === "completed" && !ratingSubmitted && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
          <h2 className="mb-2 font-display text-sm font-bold">Rate this outing</h2>
          <div className="mb-3">
            <p className="mb-1 text-xs text-white/50">Venue</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setMyRating((r) => ({ ...r, venueRating: n }))}>
                  <IconStar className={`h-6 w-6 ${n <= myRating.venueRating ? "text-vibe-orange" : "text-white/15"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <p className="mb-1 text-xs text-white/50">Vibe</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setMyRating((r) => ({ ...r, vibeRating: n }))}>
                  <IconStar className={`h-6 w-6 ${n <= myRating.vibeRating ? "text-vibe-orange" : "text-white/15"}`} />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={submitRating}
            disabled={busy || myRating.venueRating === 0 || myRating.vibeRating === 0}
            className="w-full rounded-xl bg-vibe-gradient py-2.5 text-sm font-semibold shadow-glow disabled:opacity-40"
          >
            Submit rating
          </button>
        </div>
      )}
      {isMember && outing.status === "completed" && ratingSubmitted && (
        <p className="mb-6 text-center text-xs text-white/40">Thanks for rating this outing! ⭐</p>
      )}
    </div>
  );
}
