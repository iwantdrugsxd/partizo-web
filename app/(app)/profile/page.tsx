"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { dataProvider } from "@/lib/data";
import { Report, UserProfile } from "@/lib/types";
import { computeTrustScore } from "@/lib/trust";
import { hashContact } from "@/lib/hash";
import TagPicker from "@/components/TagPicker";
import { IconImage, IconShield } from "@/components/icons";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { lowDataMode, setLowDataMode } = useSettings();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [blockedProfiles, setBlockedProfiles] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [attendedOutings, setAttendedOutings] = useState(0);
  const [trustOpen, setTrustOpen] = useState(false);
  const [idVerifying, setIdVerifying] = useState(false);
  const [videoVerifying, setVideoVerifying] = useState(false);
  const [photoCheckBusy, setPhotoCheckBusy] = useState(false);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [blockContact, setBlockContact] = useState("");
  const [blockContactBusy, setBlockContactBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!user) return;
    setBio(user.bio);
    setCity(user.city);
    setTags(user.tags);
    setEmergencyName(user.emergencyContactName ?? "");
    setEmergencyPhone(user.emergencyContactPhone ?? "");
  }, [user]);

  useEffect(() => {
    if (!user) return;
    Promise.all(user.blockedUserIds.map((id) => dataProvider.getUser(id))).then((list) => {
      setBlockedProfiles(list.filter(Boolean) as UserProfile[]);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    dataProvider.getMyOutings(user.uid).then((outings) => {
      const count = outings.filter((o) => o.memberIds.includes(user.uid) && o.dateTime < Date.now()).length;
      setAttendedOutings(count);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    dataProvider.getMyReports(user.uid).then(setMyReports);
  }, [user]);

  if (!user) return null;

  async function saveProfile() {
    setSaving(true);
    try {
      await dataProvider.updateProfile(user!.uid, {
        bio,
        city,
        tags,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
      });
      await refresh();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function getVerified() {
    setVerifying(true);
    await dataProvider.requestVerification(user!.uid);
    await refresh();
  }

  async function getIdVerified() {
    setIdVerifying(true);
    await dataProvider.requestIdVerification(user!.uid);
    await refresh();
  }

  async function getVideoVerified() {
    setVideoVerifying(true);
    await dataProvider.requestVideoVerification(user!.uid);
    await refresh();
  }

  async function runPhotoCheck() {
    setPhotoCheckBusy(true);
    try {
      await dataProvider.runPhotoCheck(user!.uid);
      await refresh();
    } finally {
      setPhotoCheckBusy(false);
    }
  }

  async function addBlockedContact() {
    if (!blockContact.trim()) return;
    setBlockContactBusy(true);
    try {
      const hash = await hashContact(blockContact.trim());
      if (!user!.blockedContactHashes.includes(hash)) {
        await dataProvider.updateProfile(user!.uid, {
          blockedContactHashes: [...user!.blockedContactHashes, hash],
        });
        await refresh();
      }
      setBlockContact("");
    } finally {
      setBlockContactBusy(false);
    }
  }

  async function removeBlockedContact(hash: string) {
    await dataProvider.updateProfile(user!.uid, {
      blockedContactHashes: user!.blockedContactHashes.filter((h) => h !== hash),
    });
    await refresh();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const url = await dataProvider.uploadPhoto(user!.uid, file);
      await dataProvider.updateProfile(user!.uid, { photos: [url, ...user!.photos.slice(1)] });
      await refresh();
    } catch {
      setPhotoError("Couldn't upload that photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function unblock(id: string) {
    await dataProvider.updateProfile(user!.uid, {
      blockedUserIds: user!.blockedUserIds.filter((b) => b !== id),
    });
    await refresh();
  }

  async function signOut() {
    await dataProvider.signOutUser();
    router.replace("/login");
  }

  return (
    <div className="px-5 pt-6 pb-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-gradient">Profile</h1>
        <button onClick={() => (editing ? saveProfile() : setEditing(true))} className="text-sm font-medium text-vibe-coral">
          {editing ? (saving ? "Saving..." : "Save") : "Edit"}
        </button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-vibe-coral">
          {user.photos[0] && <Image src={user.photos[0]} alt="" fill className="object-cover" unoptimized />}
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
          <div className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-vibe-ink bg-vibe-gradient">
            <IconImage className="h-3 w-3 text-white" />
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingPhoto}
            onChange={handlePhotoChange}
          />
        </label>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display text-lg font-bold">
              {user.name}, {user.age}
            </p>
            {user.verified && <span className="text-vibe-coral">✓</span>}
          </div>
          <p className="text-xs text-white/50">{user.city}</p>
          <p className="mt-1 text-xs font-semibold text-vibe-orange">{user.personalityLabel}</p>
        </div>
      </div>
      {photoError && <p className="mb-4 -mt-4 text-xs text-red-400">{photoError}</p>}

      {editing ? (
        <div className="mb-6 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Vibe tags</label>
            <TagPicker selected={tags} onChange={setTags} />
          </div>
        </div>
      ) : (
        <div className="mb-6">
          {user.bio && <p className="mb-3 text-sm text-white/70">{user.bio}</p>}
          <div className="flex flex-wrap gap-2">
            {user.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <IconShield className="h-4 w-4 text-vibe-coral" />
          <h2 className="font-display text-sm font-bold">Safety & Trust</h2>
        </div>

        {(() => {
          const trust = computeTrustScore(user, attendedOutings);
          return (
            <button
              onClick={() => setTrustOpen((o) => !o)}
              className="mb-4 block w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold">{trust.level}</span>
                <span className="text-xs text-white/50">{trust.score}/100</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-vibe-gradient" style={{ width: `${trust.score}%` }} />
              </div>
              {trustOpen && (
                <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                  {trust.breakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-xs">
                      <span className={item.achieved ? "text-white/80" : "text-white/40"}>
                        {item.achieved ? "✓" : "○"} {item.label}
                      </span>
                      <span className="text-white/40">+{item.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })()}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Profile verification</p>
            <p className="text-xs text-white/40">
              {user.verificationStatus === "verified"
                ? "You're verified"
                : user.verificationStatus === "pending"
                ? "Review in progress..."
                : "Build trust with a verified badge"}
            </p>
          </div>
          {user.verificationStatus === "none" && (
            <button
              onClick={getVerified}
              disabled={verifying}
              className="rounded-full bg-vibe-gradient px-4 py-2 text-xs font-semibold"
            >
              Verify
            </button>
          )}
          {user.verificationStatus === "pending" && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
          )}
          {user.verificationStatus === "verified" && <span className="text-lg">✅</span>}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Government ID verification</p>
            <p className="text-xs text-white/40">
              {user.idVerificationStatus === "verified"
                ? "Highly Trusted tier unlocked"
                : user.idVerificationStatus === "pending"
                ? "Review in progress..."
                : "Upload a government ID for the highest trust tier"}
            </p>
          </div>
          {user.idVerificationStatus === "none" && (
            <button
              onClick={getIdVerified}
              disabled={idVerifying}
              className="rounded-full bg-vibe-gradient px-4 py-2 text-xs font-semibold"
            >
              Verify
            </button>
          )}
          {user.idVerificationStatus === "pending" && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
          )}
          {user.idVerificationStatus === "verified" && <span className="text-lg">🪪</span>}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Video verification</p>
            <p className="text-xs text-white/40">
              {user.videoVerificationStatus === "verified"
                ? "Your video was reviewed and matches your photos"
                : user.videoVerificationStatus === "pending"
                ? "Review in progress..."
                : "Record a short video to prove you're really you"}
            </p>
          </div>
          {user.videoVerificationStatus === "none" && (
            <button
              onClick={getVideoVerified}
              disabled={videoVerifying}
              className="rounded-full bg-vibe-gradient px-4 py-2 text-xs font-semibold"
            >
              Record
            </button>
          )}
          {user.videoVerificationStatus === "pending" && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
          )}
          {user.videoVerificationStatus === "verified" && <span className="text-lg">🎥</span>}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Photo authenticity check</p>
            <p className="text-xs text-white/40">
              {user.photoCheckStatus === "clear"
                ? "Your photos passed our automated check"
                : user.photoCheckStatus === "flagged"
                ? "One or more photos need a second look"
                : "Heuristic scan for stock/stolen photos (not a guarantee)"}
            </p>
          </div>
          {!user.photoCheckStatus && (
            <button
              onClick={runPhotoCheck}
              disabled={photoCheckBusy}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Scan
            </button>
          )}
          {user.photoCheckStatus === "clear" && <span className="text-lg">🛡️</span>}
          {user.photoCheckStatus === "flagged" && <span className="text-lg">⚠️</span>}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Low-data mode</p>
            <p className="text-xs text-white/40">Lighter images, fewer animations - great for slower networks</p>
          </div>
          <button
            onClick={() => setLowDataMode(!lowDataMode)}
            className={`h-6 w-11 rounded-full p-0.5 transition-colors ${lowDataMode ? "bg-vibe-gradient" : "bg-white/15"}`}
          >
            <motion.div layout className="h-5 w-5 rounded-full bg-white" style={{ marginLeft: lowDataMode ? "auto" : 0 }} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Read receipts</p>
            <p className="text-xs text-white/40">Let matches see when you&apos;ve read their messages (mutual - you&apos;ll see theirs too)</p>
          </div>
          <button
            onClick={async () => {
              await dataProvider.updateProfile(user.uid, { readReceiptsEnabled: !user.readReceiptsEnabled });
              await refresh();
            }}
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${user.readReceiptsEnabled ? "bg-vibe-gradient" : "bg-white/15"}`}
          >
            <motion.div layout className="h-5 w-5 rounded-full bg-white" style={{ marginLeft: user.readReceiptsEnabled ? "auto" : 0 }} />
          </button>
        </div>

        {myReports.length > 0 && (
          <div className="mb-4 border-t border-white/10 pt-3">
            <button
              onClick={() => setReportsOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <p className="text-sm font-medium">My reports ({myReports.length})</p>
              <span className="text-xs text-white/40">{reportsOpen ? "Hide" : "Show"}</span>
            </button>
            {reportsOpen && (
              <div className="mt-2 space-y-2">
                {myReports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                    <span className="text-white/60">{r.reason}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                        r.status === "resolved"
                          ? "bg-green-400/15 text-green-300"
                          : r.status === "reviewing"
                          ? "bg-vibe-orange/15 text-vibe-orange"
                          : "bg-white/10 text-white/50"
                      }`}
                    >
                      {r.status === "open" ? "Received" : r.status === "reviewing" ? "In review" : "Resolved"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-sm font-medium">Emergency contact</p>
          <p className="mb-2 text-xs text-white/40">
            Shared only when you use &ldquo;Share outing status&rdquo; before meeting someone new.
          </p>
          <div className="flex gap-2">
            <input
              placeholder="Contact name"
              value={emergencyName}
              disabled={!editing}
              onChange={(e) => setEmergencyName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral disabled:opacity-60"
            />
            <input
              placeholder="Phone"
              value={emergencyPhone}
              disabled={!editing}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {blockedProfiles.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
          <h2 className="mb-3 font-display text-sm font-bold">Blocked</h2>
          <div className="space-y-2">
            {blockedProfiles.map((p) => (
              <div key={p.uid} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <button onClick={() => unblock(p.uid)} className="text-xs text-vibe-coral">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-white/10 bg-vibe-card/70 p-4">
        <h2 className="mb-1 font-display text-sm font-bold">Contact blocklist</h2>
        <p className="mb-3 text-xs text-white/40">
          Block someone by phone or email before they even sign up. We only store a one-way hash - never the raw
          number or address.
        </p>
        <div className="mb-3 flex gap-2">
          <input
            value={blockContact}
            onChange={(e) => setBlockContact(e.target.value)}
            placeholder="Phone or email"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral"
          />
          <button
            onClick={addBlockedContact}
            disabled={blockContactBusy || !blockContact.trim()}
            className="shrink-0 rounded-xl bg-vibe-gradient px-4 py-2 text-xs font-semibold disabled:opacity-40"
          >
            Block
          </button>
        </div>
        {user.blockedContactHashes.length > 0 && (
          <div className="space-y-1.5">
            {user.blockedContactHashes.map((hash) => (
              <div key={hash} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-xs">
                <span className="font-mono text-white/40">{hash.slice(0, 12)}...</span>
                <button onClick={() => removeBlockedContact(hash)} className="text-vibe-coral">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={signOut} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50">
        Sign out
      </button>
    </div>
  );
}
