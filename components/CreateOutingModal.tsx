"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { UserProfile } from "@/lib/types";
import { VIBE_TAGS } from "@/data/tags";
import { OUTING_TEMPLATES } from "@/data/outingTemplates";
import { safeSpotsForCity } from "@/data/safeSpots";
import { coordsForCity } from "@/lib/geo";
import LocationSearch from "@/components/LocationSearch";
import { IconMapPin, IconX } from "@/components/icons";

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
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [matchProfiles, setMatchProfiles] = useState<UserProfile[]>([]);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatCount, setRepeatCount] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    dataProvider.getMatches(user.uid).then(async (matches) => {
      const otherUids = matches.map((m) => m.userIds.find((id) => id !== user.uid)!).filter(Boolean);
      const profiles = await Promise.all(otherUids.map((id) => dataProvider.getUser(id)));
      setMatchProfiles(profiles.filter((p): p is UserProfile => Boolean(p)));
    });
  }, [open, user]);

  function toggleTag(tag: string) {
    setVibeTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : t.length < 5 ? [...t, tag] : t));
  }

  function toggleInvitee(uid: string) {
    setInvitedUserIds((ids) => (ids.includes(uid) ? ids.filter((x) => x !== uid) : [...ids, uid]));
  }

  function applyTemplate(templateId: string) {
    const t = OUTING_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setTitle(t.title);
    setCategory(t.category);
    setDescription(t.description);
    setVibeTags(t.vibeTags);
    setCapacity(t.capacity);
    if (t.id === "standing_dinner") setRepeatWeekly(true);
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
    setVisibility("public");
    setInvitedUserIds([]);
    setRepeatWeekly(false);
    setRepeatCount(4);
    setPinnedCoords(null);
    setLocationError("");
  }

  function useMyLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPinnedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Location permission was denied - enable it in your browser settings to pin the map.");
        setLocating(false);
      }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const coords = pinnedCoords ?? coordsForCity(user.city);
      const outing = await dataProvider.createOuting({
        leaderId: user.uid,
        title,
        category,
        description,
        location,
        lat: coords?.lat,
        lng: coords?.lng,
        dateTime: dateTime ? new Date(dateTime).getTime() : Date.now() + 3600_000,
        capacity,
        minVibeScore,
        vibeTags,
        visibility,
        invitedUserIds,
        recurrence: repeatWeekly ? { freq: "weekly", count: repeatCount } : undefined,
      });
      reset();
      onClose();
      router.push(`/outings/${outing.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const safeSpots = user ? safeSpotsForCity(user.city) : [];

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
                <label className="mb-1 block text-xs font-medium text-white/50">Quick start</label>
                <div className="flex flex-wrap gap-2">
                  {OUTING_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t.id)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70"
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

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

              <div>
                <label className="mb-1 block text-xs font-medium text-white/50">Visibility</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      visibility === "public" ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
                    }`}
                  >
                    Public - anyone can request
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("private")}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      visibility === "private" ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
                    }`}
                  >
                    Private - invite only
                  </button>
                </div>
                {visibility === "private" && (
                  <div className="mt-3">
                    {matchProfiles.length === 0 ? (
                      <p className="text-xs text-white/40">
                        You don&apos;t have any matches yet to invite. Match with someone first, or make this outing public.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-white/40">Invite from your matches:</p>
                        <div className="flex flex-wrap gap-2">
                          {matchProfiles.map((p) => (
                            <button
                              key={p.uid}
                              type="button"
                              onClick={() => toggleInvitee(p.uid)}
                              className={`rounded-full border px-3 py-1.5 text-xs ${
                                invitedUserIds.includes(p.uid)
                                  ? "border-transparent bg-vibe-gradient"
                                  : "border-white/15 text-white/60"
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/50">Location</label>
                  <LocationSearch
                    value={location}
                    onChange={setLocation}
                    coords={pinnedCoords}
                    onPickCoords={setPinnedCoords}
                  />
                  {safeSpots.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1.5 text-[11px] text-white/40">Safety tip: pick a well-lit public spot</p>
                      <div className="flex flex-wrap gap-1.5">
                        {safeSpots.map((spot) => (
                          <button
                            key={spot}
                            type="button"
                            onClick={() => setLocation(spot)}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60"
                          >
                            {spot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={locating}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 disabled:opacity-50"
                    >
                      <IconMapPin className="h-3.5 w-3.5" />
                      {locating ? "Locating..." : pinnedCoords ? "Location pinned" : "Use my current location"}
                    </button>
                    {pinnedCoords && (
                      <span className="text-[11px] text-green-400">
                        ✓ Map pin set ({pinnedCoords.lat.toFixed(3)}, {pinnedCoords.lng.toFixed(3)})
                      </span>
                    )}
                  </div>
                  {locationError && <p className="mt-1.5 text-[11px] text-red-400">{locationError}</p>}
                  <p className="mt-1.5 text-[11px] text-white/30">
                    {pinnedCoords
                      ? "This precise location will place the pin on the outings map."
                      : "Without a pinned location, the outing map will show your city's center."}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
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

              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Repeat weekly</p>
                  <p className="text-xs text-white/40">Good for a standing dinner club or weekly trek crew.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRepeatWeekly((v) => !v)}
                  className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                    repeatWeekly ? "bg-vibe-gradient" : "bg-white/15"
                  }`}
                >
                  <motion.div layout className="h-5 w-5 rounded-full bg-white" style={{ marginLeft: repeatWeekly ? "auto" : 0 }} />
                </button>
              </div>
              {repeatWeekly && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-white/50">Number of weeks: {repeatCount}</label>
                  <input
                    type="range"
                    min={2}
                    max={12}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                    className="w-full accent-vibe-coral"
                  />
                </div>
              )}

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
                disabled={submitting || (visibility === "private" && invitedUserIds.length === 0)}
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
