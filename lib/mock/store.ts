"use client";

import {
  AppNotification,
  ChatMessage,
  ChatMeta,
  Match,
  Outing,
  Report,
  SwipeRecord,
  UserProfile,
} from "@/lib/types";
import { SEED_USERS } from "@/lib/mock/seed";

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
  };
}

let cache: MockDB | null = null;
const listeners = new Map<string, Set<() => void>>();

function isBrowser() {
  return typeof window !== "undefined";
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
      cache = JSON.parse(raw) as MockDB;
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
