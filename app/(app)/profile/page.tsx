"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { dataProvider } from "@/lib/data";
import { UserProfile } from "@/lib/types";
import TagPicker from "@/components/TagPicker";
import { IconShield } from "@/components/icons";

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
        <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-vibe-coral">
          {user.photos[0] && <Image src={user.photos[0]} alt="" fill className="object-cover" unoptimized />}
        </div>
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

        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-sm font-medium">Emergency contact</p>
          <p className="mb-2 text-xs text-white/40">
            Shared only when you use "Share outing status" before meeting someone new.
          </p>
          <div className="flex gap-2">
            <input
              placeholder="Contact name"
              value={emergencyName}
              disabled={!editing}
              onChange={(e) => setEmergencyName(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral disabled:opacity-60"
            />
            <input
              placeholder="Phone"
              value={emergencyPhone}
              disabled={!editing}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral disabled:opacity-60"
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

      <button onClick={signOut} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50">
        Sign out
      </button>
    </div>
  );
}
