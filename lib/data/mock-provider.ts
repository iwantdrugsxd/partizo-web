"use client";

import {
  AppNotification,
  ChatMessage,
  ChatMeta,
  Match,
  Outing,
  UserProfile,
} from "@/lib/types";
import {
  loadDB,
  saveDB,
  subscribe,
  emit,
  getSessionUid,
  setSessionUid,
  uid as genId,
} from "@/lib/mock/store";
import { computeTraitsFromAnswers, computeVibeScore, personalityLabel, sharedTags } from "@/lib/vibe";
import {
  CreateOutingInput,
  DataProvider,
  DeckCandidate,
  SwipeResult,
} from "@/lib/data/provider";

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function pushNotification(
  db: ReturnType<typeof loadDB>,
  recipientUid: string,
  n: Omit<AppNotification, "id" | "uid" | "read" | "createdAt">
) {
  const notif: AppNotification = {
    id: genId("notif"),
    uid: recipientUid,
    read: false,
    createdAt: Date.now(),
    ...n,
  };
  db.notifications.unshift(notif);
}

function ensureChat(
  db: ReturnType<typeof loadDB>,
  memberIds: string[],
  type: ChatMeta["type"],
  title: string,
  outingId?: string
): ChatMeta {
  const id = genId("chat");
  const chat: ChatMeta = {
    id,
    type,
    memberIds,
    outingId,
    title,
    createdAt: Date.now(),
  };
  db.chats[id] = chat;
  db.messages[id] = [
    {
      id: genId("msg"),
      chatId: id,
      senderId: "system",
      text:
        type === "match"
          ? "You matched! Say hi 👋"
          : "Outing crew assembled - coordinate your plan here 🎉",
      createdAt: Date.now(),
      system: true,
    },
  ];
  return chat;
}

export const mockProvider: DataProvider = {
  async signUp(email, password, name) {
    const db = loadDB();
    const emailKey = email.trim().toLowerCase();
    if (db.credentials[emailKey]) {
      throw new Error("An account with this email already exists. Try logging in instead.");
    }
    const newUid = genId("user");
    const profile: UserProfile = {
      uid: newUid,
      name,
      age: 18,
      gender: "other",
      showMePreference: "everyone",
      city: "",
      bio: "",
      photos: [],
      tags: [],
      traits: { extraversion: 5, adventure: 5, humor: 5, depth: 5, spontaneity: 5 },
      quizAnswers: [],
      personalityLabel: "Balanced Explorer",
      verified: false,
      verificationStatus: "none",
      lowDataMode: false,
      blockedUserIds: [],
      onboardingComplete: false,
      createdAt: Date.now(),
    };
    db.users[newUid] = profile;
    db.credentials[emailKey] = { password, uid: newUid };
    saveDB(db);
    setSessionUid(newUid);
    return delay(profile);
  },

  async signIn(email, password) {
    const db = loadDB();
    const emailKey = email.trim().toLowerCase();
    const cred = db.credentials[emailKey];
    if (!cred || cred.password !== password) {
      throw new Error("Incorrect email or password.");
    }
    setSessionUid(cred.uid);
    return delay(db.users[cred.uid]);
  },

  async signOutUser() {
    setSessionUid(null);
    return delay(undefined, 100);
  },

  async getCurrentUser() {
    const db = loadDB();
    const uidVal = getSessionUid();
    if (!uidVal) return null;
    return db.users[uidVal] ?? null;
  },

  onAuthChange(cb) {
    const handler = async () => {
      const user = await mockProvider.getCurrentUser();
      cb(user);
    };
    handler();
    return subscribe("auth", handler);
  },

  async getUser(uidVal) {
    const db = loadDB();
    return db.users[uidVal] ?? null;
  },

  async updateProfile(uidVal, partial) {
    const db = loadDB();
    const existing = db.users[uidVal];
    if (!existing) return;
    db.users[uidVal] = { ...existing, ...partial };
    saveDB(db);
    emit(`user:${uidVal}`);
    emit("auth");
  },

  async completeOnboarding(uidVal, data) {
    const db = loadDB();
    const existing = db.users[uidVal];
    if (!existing) return;
    const traits = computeTraitsFromAnswers(data.quizAnswers);
    const updated: UserProfile = {
      ...existing,
      name: data.name,
      age: data.age,
      gender: data.gender,
      showMePreference: data.showMePreference,
      city: data.city,
      bio: data.bio,
      photos: data.photos,
      tags: data.tags,
      quizAnswers: data.quizAnswers,
      traits,
      personalityLabel: personalityLabel(traits),
      onboardingComplete: true,
    };
    db.users[uidVal] = updated;
    saveDB(db);
    emit("auth");
  },

  async getDeck(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return [];
    const swipedIds = new Set(
      db.swipes.filter((s) => s.fromUid === uidVal).map((s) => s.toUid)
    );
    const blocked = new Set(me.blockedUserIds);
    const candidates = Object.values(db.users).filter((u) => {
      if (u.uid === uidVal) return false;
      if (swipedIds.has(u.uid)) return false;
      if (blocked.has(u.uid)) return false;
      if (u.blockedUserIds.includes(uidVal)) return false;
      if (!u.onboardingComplete) return false;
      if (me.showMePreference !== "everyone" && u.gender !== me.showMePreference) return false;
      return true;
    });
    const withScore: DeckCandidate[] = candidates.map((c) => ({
      ...c,
      vibeScore: computeVibeScore(me, c),
      sharedTags: sharedTags(me.tags, c.tags),
    }));
    withScore.sort((a, b) => b.vibeScore - a.vibeScore);
    return delay(withScore, 300);
  },

  async recordSwipe(fromUid, toUid, direction) {
    const db = loadDB();
    db.swipes.push({
      id: `${fromUid}_${toUid}`,
      fromUid,
      toUid,
      direction,
      createdAt: Date.now(),
    });

    let result: SwipeResult = { matched: false };

    if (direction === "like") {
      const reciprocal = db.swipes.find(
        (s) => s.fromUid === toUid && s.toUid === fromUid && s.direction === "like"
      );
      if (reciprocal) {
        const me = db.users[fromUid];
        const other = db.users[toUid];
        const chat = ensureChat(db, [fromUid, toUid], "match", `${me.name} & ${other.name}`);
        const match: Match = {
          id: genId("match"),
          userIds: [fromUid, toUid],
          chatId: chat.id,
          vibeScore: computeVibeScore(me, other),
          createdAt: Date.now(),
        };
        db.matches.push(match);
        pushNotification(db, fromUid, {
          type: "new_match",
          title: "It's a vibe match! 🎉",
          body: `You and ${other.name} vibe at ${match.vibeScore}%. Say hi!`,
          linkTo: `/chats/${chat.id}`,
        });
        pushNotification(db, toUid, {
          type: "new_match",
          title: "It's a vibe match! 🎉",
          body: `You and ${me.name} vibe at ${match.vibeScore}%. Say hi!`,
          linkTo: `/chats/${chat.id}`,
        });
        result = { matched: true, match };
      }
    }

    saveDB(db);
    emit(`notifications:${toUid}`);
    emit(`notifications:${fromUid}`);
    emit(`chats:${fromUid}`);
    emit(`chats:${toUid}`);
    return delay(result, 200);
  },

  async getMatches(uidVal) {
    const db = loadDB();
    return db.matches.filter((m) => m.userIds.includes(uidVal));
  },

  async createOuting(input: CreateOutingInput) {
    const db = loadDB();
    const id = genId("outing");
    const outing: Outing = {
      id,
      leaderId: input.leaderId,
      title: input.title,
      category: input.category,
      description: input.description,
      location: input.location,
      dateTime: input.dateTime,
      capacity: input.capacity,
      minVibeScore: input.minVibeScore,
      vibeTags: input.vibeTags,
      status: "live",
      requests: [],
      memberIds: [input.leaderId],
      chatId: null,
      createdAt: Date.now(),
    };
    db.outings[id] = outing;
    saveDB(db);
    emit("outings");
    return delay(outing, 200);
  },

  async getLiveOutings(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    const all = Object.values(db.outings).filter(
      (o) => (o.status === "live" || o.status === "full") && o.leaderId !== uidVal
    );
    if (!me) return all;
    return all
      .map((o) => {
        const leader = db.users[o.leaderId];
        const score = leader ? computeVibeScore(me, leader) : 0;
        return { outing: o, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.outing);
  },

  async getMyOutings(uidVal) {
    const db = loadDB();
    return Object.values(db.outings).filter(
      (o) => o.leaderId === uidVal || o.memberIds.includes(uidVal)
    );
  },

  async getOuting(id) {
    const db = loadDB();
    return db.outings[id] ?? null;
  },

  subscribeOuting(id, cb) {
    const handler = () => {
      const db = loadDB();
      cb(db.outings[id] ?? null);
    };
    handler();
    return subscribe("outings", handler);
  },

  async requestToJoin(outingId, uidVal) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return;
    if (outing.requests.some((r) => r.uid === uidVal) || outing.memberIds.includes(uidVal)) {
      return;
    }
    outing.requests.push({ uid: uidVal, status: "pending", requestedAt: Date.now() });
    saveDB(db);
    const requester = db.users[uidVal];
    pushNotification(db, outing.leaderId, {
      type: "outing_request_received",
      title: "New outing request",
      body: `${requester?.name ?? "Someone"} wants to join "${outing.title}"`,
      linkTo: `/outings/${outing.id}`,
    });
    saveDB(db);
    emit("outings");
    emit(`notifications:${outing.leaderId}`);
  },

  async respondToRequest(outingId, targetUid, accept) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return;
    const req = outing.requests.find((r) => r.uid === targetUid);
    if (!req) return;
    req.status = accept ? "accepted" : "rejected";

    if (accept) {
      outing.memberIds.push(targetUid);
      if (!outing.chatId) {
        const leader = db.users[outing.leaderId];
        const chat = ensureChat(db, [outing.leaderId], "outing", outing.title, outing.id);
        outing.chatId = chat.id;
      }
      const chat = db.chats[outing.chatId!];
      if (chat && !chat.memberIds.includes(targetUid)) {
        chat.memberIds.push(targetUid);
      }
      if (outing.memberIds.length >= outing.capacity) {
        outing.status = "full";
      }
    }

    pushNotification(db, targetUid, {
      type: accept ? "outing_request_accepted" : "outing_request_rejected",
      title: accept ? "You're in! 🎉" : "Request declined",
      body: accept
        ? `Your request to join "${outing.title}" was accepted. Head to the group chat!`
        : `Your request to join "${outing.title}" wasn't accepted this time.`,
      linkTo: accept && outing.chatId ? `/chats/${outing.chatId}` : `/outings`,
    });

    saveDB(db);
    emit("outings");
    emit(`notifications:${targetUid}`);
    emit(`chats:${targetUid}`);
  },

  async getChats(uidVal) {
    const db = loadDB();
    return Object.values(db.chats)
      .filter((c) => c.memberIds.includes(uidVal))
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
  },

  async getChat(id) {
    const db = loadDB();
    return db.chats[id] ?? null;
  },

  subscribeChats(uidVal, cb) {
    const handler = async () => {
      cb(await mockProvider.getChats(uidVal));
    };
    handler();
    return subscribe(`chats:${uidVal}`, handler);
  },

  subscribeMessages(chatId, cb) {
    const handler = () => {
      const db = loadDB();
      cb(db.messages[chatId] ?? []);
    };
    handler();
    return subscribe(`messages:${chatId}`, handler);
  },

  async sendMessage(chatId, senderId, text) {
    const db = loadDB();
    const chat = db.chats[chatId];
    if (!chat) return;
    const message: ChatMessage = {
      id: genId("msg"),
      chatId,
      senderId,
      text,
      createdAt: Date.now(),
    };
    if (!db.messages[chatId]) db.messages[chatId] = [];
    db.messages[chatId].push(message);
    chat.lastMessage = text;
    chat.lastMessageAt = message.createdAt;

    for (const memberUid of chat.memberIds) {
      if (memberUid === senderId) continue;
      const sender = db.users[senderId];
      pushNotification(db, memberUid, {
        type: "new_message",
        title: sender?.name ?? "New message",
        body: text,
        linkTo: `/chats/${chatId}`,
      });
    }

    saveDB(db);
    emit(`messages:${chatId}`);
    for (const memberUid of chat.memberIds) {
      emit(`chats:${memberUid}`);
      emit(`notifications:${memberUid}`);
    }
  },

  async getNotifications(uidVal) {
    const db = loadDB();
    return db.notifications
      .filter((n) => n.uid === uidVal)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  subscribeNotifications(uidVal, cb) {
    const handler = async () => {
      cb(await mockProvider.getNotifications(uidVal));
    };
    handler();
    return subscribe(`notifications:${uidVal}`, handler);
  },

  async markNotificationRead(uidVal, id) {
    const db = loadDB();
    const n = db.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read = true;
    saveDB(db);
    emit(`notifications:${uidVal}`);
  },

  async markAllNotificationsRead(uidVal) {
    const db = loadDB();
    db.notifications.filter((n) => n.uid === uidVal).forEach((n) => (n.read = true));
    saveDB(db);
    emit(`notifications:${uidVal}`);
  },

  async reportUser(reporterId, reportedId, reason) {
    const db = loadDB();
    db.reports.push({ id: genId("report"), reporterId, reportedId, reason, createdAt: Date.now() });
    saveDB(db);
  },

  async blockUser(uidVal, blockedUid) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return;
    if (!me.blockedUserIds.includes(blockedUid)) {
      me.blockedUserIds.push(blockedUid);
    }
    saveDB(db);
    emit("auth");
  },

  async requestVerification(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return;
    me.verificationStatus = "pending";
    saveDB(db);
    emit("auth");
    // Simulate a review pipeline approving the demo account shortly after.
    setTimeout(() => {
      const latest = loadDB();
      const user = latest.users[uidVal];
      if (user && user.verificationStatus === "pending") {
        user.verificationStatus = "verified";
        user.verified = true;
        pushNotification(latest, uidVal, {
          type: "safety_checkin",
          title: "You're verified ✅",
          body: "Your profile now shows the verified badge. This builds trust with your matches.",
        });
        saveDB(latest);
        emit("auth");
        emit(`notifications:${uidVal}`);
      }
    }, 4000);
  },
};
