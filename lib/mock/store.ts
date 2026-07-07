"use client";

import {
  AppNotification,
  ChatMessage,
  ChatMeta,
  Expense,
  LiveLocationShare,
  Match,
  Outing,
  OutingPoll,
  OutingRating,
  ReconnectPick,
  Report,
  SafetyCheckin,
  SwipeRecord,
  UserProfile,
} from "@/lib/types";
import { SEED_USERS } from "@/lib/mock/seed";
import { coordsForCity } from "@/lib/geo";

const STORAGE_KEY = "partizo_mock_db_v1";
const SESSION_KEY = "partizo_mock_session_v1";

export interface MockDB {
  users: Record<string, UserProfile>;
  credentials: Record<string, { password: string; uid: string }>; // keyed by email
  swipes: SwipeRecord[];
  matches: Match[];
  outings: Record<string, Outing>;
  chats: Record<string, ChatMeta>;
  messages: Record<string, ChatMessage[]>;
  notifications: AppNotification[];
  reports: Report[];
  safetyCheckins: SafetyCheckin[];
  reconnectPicks: ReconnectPick[];
  polls: OutingPoll[];
  expenses: Expense[];
  ratings: OutingRating[];
  liveLocations: LiveLocationShare[];
}

function emptyDB(): MockDB {
  const users: Record<string, UserProfile> = {};
  for (const u of SEED_USERS) users[u.uid] = u;
  return {
    users,
    credentials: {},
    swipes: [],
    matches: [],
    outings: {},
    chats: {},
    messages: {},
    notifications: [],
    reports: [],
    safetyCheckins: [],
    reconnectPicks: [],
    polls: [],
    expenses: [],
    ratings: [],
    liveLocations: [],
  };
}

let cache: MockDB | null = null;
const listeners = new Map<string, Set<() => void>>();

function isBrowser() {
  return typeof window !== "undefined";
}

/** Backfills fields added in later schema versions so old localStorage data doesn't crash newer code. */
function migrate(db: MockDB): MockDB {
  db.safetyCheckins ??= [];
  db.reconnectPicks ??= [];
  db.polls ??= [];
  db.expenses ??= [];
  db.ratings ??= [];
  db.liveLocations ??= [];
  for (const u of Object.values(db.users)) {
    u.prompts ??= [];
    u.idVerificationStatus ??= "none";
    u.videoVerificationStatus ??= "none";
    u.readReceiptsEnabled ??= false;
    u.blockedContactHashes ??= [];
    if (u.lat === undefined || u.lng === undefined) {
      const coords = coordsForCity(u.city);
      if (coords) {
        u.lat = coords.lat;
        u.lng = coords.lng;
      }
    }
  }
  for (const o of Object.values(db.outings)) {
    o.visibility ??= "public";
    o.invitedUserIds ??= [];
    o.reminderSent ??= false;
    o.reconnectSubmittedUids ??= [];
    o.photoAlbum ??= [];
    if ((o.lat === undefined || o.lng === undefined) && o.location) {
      const owner = db.users[o.leaderId];
      const coords = owner ? coordsForCity(owner.city) : null;
      if (coords) {
        o.lat = coords.lat;
        o.lng = coords.lng;
      }
    }
  }
  for (const r of db.reports) {
    r.status ??= "open";
  }
  return db;
}

export function loadDB(): MockDB {
  if (cache) return cache;
  if (!isBrowser()) {
    cache = emptyDB();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = migrate(JSON.parse(raw) as MockDB);
      return cache;
    }
  } catch {
    // fall through to fresh db
  }
  cache = emptyDB();
  saveDB(cache);
  return cache;
}

export function saveDB(db: MockDB) {
  cache = db;
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

export function resetDB() {
  cache = emptyDB();
  saveDB(cache);
  emit("*");
}

/** Subscribe to a topic; call emit(topic) whenever that slice changes. */
export function subscribe(topic: string, cb: () => void): () => void {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(cb);
  return () => {
    listeners.get(topic)?.delete(cb);
  };
}

export function emit(topic: string) {
  listeners.get(topic)?.forEach((cb) => cb());
  listeners.get("*")?.forEach((cb) => cb());
}

// --- Session (mock auth) helpers ---
export function getSessionUid(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setSessionUid(uid: string | null) {
  if (!isBrowser()) return;
  if (uid) window.localStorage.setItem(SESSION_KEY, uid);
  else window.localStorage.removeItem(SESSION_KEY);
  emit("auth");
}

export function uid(prefix = "u"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
