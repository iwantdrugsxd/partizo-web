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
  SafetyCheckin,
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
import { coordsForCity, distanceKm } from "@/lib/geo";
import {
  CreateOutingInput,
  DataProvider,
  DeckCandidate,
  DeckFilters,
  SwipeResult,
} from "@/lib/data/provider";

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Ephemeral (non-persisted) typing state: "chatId:uid" -> expiry timestamp.
const typingState = new Map<string, number>();

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

/** Lazily flips an outing to "completed" once its dateTime has passed - no cron needed for a mock backend. */
function refreshOutingStatus(db: ReturnType<typeof loadDB>, outing: Outing): Outing {
  if ((outing.status === "live" || outing.status === "full") && outing.dateTime < Date.now()) {
    outing.status = "completed";
    saveDB(db);
  }
  return outing;
}

/** Total seats occupied - each accepted member counts as 1, plus any guests they're bringing. */
function occupiedSeats(outing: Outing): number {
  const guestSeats = outing.requests
    .filter((r) => r.status === "accepted" && outing.memberIds.includes(r.uid))
    .reduce((sum, r) => sum + (r.guestCount ?? 0), 0);
  return outing.memberIds.length + guestSeats;
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
      prompts: [],
      traits: { extraversion: 5, adventure: 5, humor: 5, depth: 5, spontaneity: 5 },
      quizAnswers: [],
      personalityLabel: "Balanced Explorer",
      verified: false,
      verificationStatus: "none",
      idVerificationStatus: "none",
      videoVerificationStatus: "none",
      lowDataMode: false,
      readReceiptsEnabled: false,
      blockedUserIds: [],
      blockedContactHashes: [],
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
    const coords = coordsForCity(data.city);
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
      prompts: data.prompts,
      quizAnswers: data.quizAnswers,
      traits,
      personalityLabel: personalityLabel(traits),
      onboardingComplete: true,
      ...(coords ?? {}),
    };
    db.users[uidVal] = updated;
    saveDB(db);
    emit("auth");
  },

  async uploadPhoto(_uidVal, file) {
    // No real backend in mock mode - just read the file as a data URL, same as
    // the app already did before real uploads existed.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  async getDeck(uidVal, filters) {
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
      if (filters?.minAge !== undefined && u.age < filters.minAge) return false;
      if (filters?.maxAge !== undefined && u.age > filters.maxAge) return false;
      if (filters?.requiredTags?.length && !filters.requiredTags.some((t) => u.tags.includes(t))) return false;
      return true;
    });
    let withScore: DeckCandidate[] = candidates.map((c) => ({
      ...c,
      vibeScore: computeVibeScore(me, c),
      sharedTags: sharedTags(me.tags, c.tags),
      distanceKm:
        me.lat !== undefined && me.lng !== undefined && c.lat !== undefined && c.lng !== undefined
          ? Math.round(distanceKm({ lat: me.lat, lng: me.lng }, { lat: c.lat, lng: c.lng }))
          : undefined,
    }));
    if (filters?.minVibeScore !== undefined) {
      withScore = withScore.filter((c) => c.vibeScore >= filters.minVibeScore!);
    }
    if (filters?.maxDistanceKm !== undefined) {
      withScore = withScore.filter((c) => c.distanceKm === undefined || c.distanceKm <= filters.maxDistanceKm!);
    }
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

  async undoLastSwipe(uidVal) {
    const db = loadDB();
    const mine = db.swipes
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.fromUid === uidVal)
      .sort((a, b) => b.s.createdAt - a.s.createdAt);
    const last = mine[0];
    if (!last) return null;

    const other = db.users[last.s.toUid];
    if (!other) return null;

    // If that swipe had produced a match (just now), undo it too - it's the same action.
    const matchIdx = db.matches.findIndex(
      (m) => m.userIds.includes(uidVal) && m.userIds.includes(last.s.toUid)
    );
    if (matchIdx !== -1) {
      const [removedMatch] = db.matches.splice(matchIdx, 1);
      delete db.chats[removedMatch.chatId];
      delete db.messages[removedMatch.chatId];
    }

    db.swipes.splice(last.i, 1);
    saveDB(db);
    emit(`chats:${uidVal}`);
    emit(`chats:${last.s.toUid}`);

    const me = db.users[uidVal];
    return {
      ...other,
      vibeScore: computeVibeScore(me, other),
      sharedTags: sharedTags(me.tags, other.tags),
    };
  },

  async getLikedByUsers(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return [];
    const alreadyActedOn = new Set(
      db.swipes.filter((s) => s.fromUid === uidVal).map((s) => s.toUid)
    );
    const admirerIds = db.swipes
      .filter((s) => s.toUid === uidVal && s.direction === "like" && !alreadyActedOn.has(s.fromUid))
      .map((s) => s.fromUid);
    return admirerIds
      .map((id) => db.users[id])
      .filter((u): u is UserProfile => Boolean(u && u.onboardingComplete))
      .map((u) => ({ ...u, vibeScore: computeVibeScore(me, u), sharedTags: sharedTags(me.tags, u.tags) }));
  },

  async getMatches(uidVal) {
    const db = loadDB();
    return db.matches.filter((m) => m.userIds.includes(uidVal));
  },

  async createOuting(input: CreateOutingInput) {
    const db = loadDB();
    const instanceCount = input.recurrence ? Math.max(1, input.recurrence.count) : 1;
    const seriesId = input.recurrence ? genId("series") : undefined;
    let firstOuting: Outing | null = null;

    for (let i = 0; i < instanceCount; i++) {
      const id = genId("outing");
      const outing: Outing = {
        id,
        leaderId: input.leaderId,
        title: input.title,
        category: input.category,
        description: input.description,
        location: input.location,
        lat: input.lat,
        lng: input.lng,
        dateTime: input.dateTime + i * 7 * 24 * 60 * 60 * 1000,
        capacity: input.capacity,
        minVibeScore: input.minVibeScore,
        vibeTags: input.vibeTags,
        visibility: input.visibility,
        invitedUserIds: input.invitedUserIds,
        status: "live",
        requests: [],
        memberIds: [input.leaderId],
        chatId: null,
        reminderSent: false,
        reconnectSubmittedUids: [],
        photoAlbum: [],
        recurrence: input.recurrence && seriesId ? { freq: input.recurrence.freq, count: instanceCount, seriesId } : undefined,
        createdAt: Date.now(),
      };
      db.outings[id] = outing;
      if (i === 0) firstOuting = outing;
    }
    saveDB(db);
    emit("outings");

    if (input.visibility === "private" && input.invitedUserIds.length > 0 && firstOuting) {
      const leader = db.users[input.leaderId];
      for (const invitedUid of input.invitedUserIds) {
        pushNotification(db, invitedUid, {
          type: "outing_request_received",
          title: "You're invited to a private outing",
          body: `${leader?.name ?? "Someone"} invited you to "${firstOuting.title}"`,
          linkTo: `/outings/${firstOuting.id}`,
        });
      }
      saveDB(db);
    }
    return delay(firstOuting!, 200);
  },

  async getLiveOutings(uidVal, filters) {
    const db = loadDB();
    const me = db.users[uidVal];
    const q = filters?.query?.trim().toLowerCase();
    const all = Object.values(db.outings)
      .map((o) => refreshOutingStatus(db, o))
      .filter((o) => {
        if (o.status !== "live" && o.status !== "full") return false;
        if (o.leaderId === uidVal) return false;
        if (o.visibility === "private" && !o.invitedUserIds.includes(uidVal)) return false;
        if (q && !o.title.toLowerCase().includes(q) && !o.description.toLowerCase().includes(q)) return false;
        if (filters?.category && o.category !== filters.category) return false;
        if (filters?.fromDate !== undefined && o.dateTime < filters.fromDate) return false;
        if (filters?.toDate !== undefined && o.dateTime > filters.toDate) return false;
        return true;
      });
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
    return Object.values(db.outings)
      .map((o) => refreshOutingStatus(db, o))
      .filter((o) => o.leaderId === uidVal || o.memberIds.includes(uidVal));
  },

  async getOuting(id) {
    const db = loadDB();
    const outing = db.outings[id];
    return outing ? refreshOutingStatus(db, outing) : null;
  },

  subscribeOuting(id, cb) {
    const handler = () => {
      const db = loadDB();
      const outing = db.outings[id];
      cb(outing ? refreshOutingStatus(db, outing) : null);
    };
    handler();
    return subscribe("outings", handler);
  },

  async requestToJoin(outingId, uidVal, guestCount) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return;
    if (outing.requests.some((r) => r.uid === uidVal) || outing.memberIds.includes(uidVal)) {
      return;
    }
    if (outing.visibility === "private" && !outing.invitedUserIds.includes(uidVal)) {
      return;
    }
    const isWaitlisted = occupiedSeats(outing) >= outing.capacity;
    outing.requests.push({
      uid: uidVal,
      status: isWaitlisted ? "waitlisted" : "pending",
      requestedAt: Date.now(),
      guestCount: guestCount && guestCount > 0 ? guestCount : undefined,
    });
    const requester = db.users[uidVal];
    pushNotification(db, outing.leaderId, {
      type: "outing_request_received",
      title: isWaitlisted ? "New outing waitlist request" : "New outing request",
      body: isWaitlisted
        ? `${requester?.name ?? "Someone"} joined the waitlist for "${outing.title}" (it's full)`
        : `${requester?.name ?? "Someone"} wants to join "${outing.title}"`,
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

    if (accept && occupiedSeats(outing) + (req.guestCount ?? 0) >= outing.capacity) {
      // Outing filled up since this request came in - park it on the waitlist instead.
      req.status = "waitlisted";
      saveDB(db);
      emit("outings");
      return;
    }

    req.status = accept ? "accepted" : "rejected";

    if (accept) {
      outing.memberIds.push(targetUid);
      if (!outing.chatId) {
        const chat = ensureChat(db, [outing.leaderId], "outing", outing.title, outing.id);
        outing.chatId = chat.id;
      }
      const chat = db.chats[outing.chatId!];
      if (chat && !chat.memberIds.includes(targetUid)) {
        chat.memberIds.push(targetUid);
      }
      if (occupiedSeats(outing) >= outing.capacity) {
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

  async leaveOuting(outingId, uidVal) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return;
    if (outing.leaderId === uidVal) return; // leaders close the outing instead of leaving it

    outing.memberIds = outing.memberIds.filter((id) => id !== uidVal);
    // Drop their own request record so they're free to request to join again later.
    outing.requests = outing.requests.filter((r) => r.uid !== uidVal);
    if (outing.status === "full" && occupiedSeats(outing) < outing.capacity) {
      outing.status = "live";
    }
    if (outing.chatId) {
      const chat = db.chats[outing.chatId];
      if (chat) chat.memberIds = chat.memberIds.filter((id) => id !== uidVal);
    }

    // Promote the longest-waiting person off the waitlist into the open spot.
    const nextInLine = outing.requests
      .filter((r) => r.status === "waitlisted")
      .sort((a, b) => a.requestedAt - b.requestedAt)[0];
    if (nextInLine && occupiedSeats(outing) + (nextInLine.guestCount ?? 0) < outing.capacity) {
      nextInLine.status = "accepted";
      outing.memberIds.push(nextInLine.uid);
      if (outing.chatId) {
        const chat = db.chats[outing.chatId];
        if (chat && !chat.memberIds.includes(nextInLine.uid)) chat.memberIds.push(nextInLine.uid);
      }
      pushNotification(db, nextInLine.uid, {
        type: "outing_request_accepted",
        title: "A spot opened up! 🎉",
        body: `You're in for "${outing.title}" - a spot opened up on the waitlist.`,
        linkTo: outing.chatId ? `/chats/${outing.chatId}` : `/outings`,
      });
    }

    const leaverName = db.users[uidVal]?.name ?? "Someone";
    pushNotification(db, outing.leaderId, {
      type: "outing_request_rejected",
      title: "Someone left your outing",
      body: `${leaverName} left "${outing.title}".`,
      linkTo: `/outings/${outing.id}`,
    });

    saveDB(db);
    emit("outings");
    emit(`notifications:${outing.leaderId}`);
    if (nextInLine) emit(`notifications:${nextInLine.uid}`);
  },

  async checkOutingReminders(uidVal) {
    const db = loadDB();
    const upcoming = Object.values(db.outings).filter(
      (o) =>
        o.memberIds.includes(uidVal) &&
        !o.reminderSent &&
        o.dateTime > Date.now() &&
        o.dateTime - Date.now() < 24 * 60 * 60 * 1000
    );
    if (upcoming.length === 0) return;
    for (const outing of upcoming) {
      outing.reminderSent = true;
      pushNotification(db, uidVal, {
        type: "outing_reminder",
        title: "Outing starts soon",
        body: `"${outing.title}" is coming up. Don't forget to share your outing status for safety.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
    saveDB(db);
    emit(`notifications:${uidVal}`);
  },

  async cancelOuting(outingId, uidVal, reason) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || outing.leaderId !== uidVal) return;
    outing.status = "cancelled";
    outing.cancelReason = reason;
    for (const memberUid of outing.memberIds) {
      if (memberUid === uidVal) continue;
      pushNotification(db, memberUid, {
        type: "outing_cancelled",
        title: "Outing cancelled",
        body: reason ? `"${outing.title}" was cancelled: ${reason}` : `"${outing.title}" was cancelled by the host.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
    saveDB(db);
    emit("outings");
    for (const memberUid of outing.memberIds) emit(`notifications:${memberUid}`);
  },

  async rescheduleOuting(outingId, uidVal, newDateTime) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || outing.leaderId !== uidVal) return;
    outing.dateTime = newDateTime;
    outing.reminderSent = false;
    if (outing.status === "completed") outing.status = occupiedSeats(outing) >= outing.capacity ? "full" : "live";
    for (const memberUid of outing.memberIds) {
      if (memberUid === uidVal) continue;
      pushNotification(db, memberUid, {
        type: "outing_cancelled",
        title: "Outing rescheduled",
        body: `"${outing.title}" moved to ${new Date(newDateTime).toLocaleString()}.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
    saveDB(db);
    emit("outings");
    for (const memberUid of outing.memberIds) emit(`notifications:${memberUid}`);
  },

  async setCoHost(outingId, uidVal, coHostUid) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || outing.leaderId !== uidVal) return;
    if (coHostUid && !outing.memberIds.includes(coHostUid)) return;
    outing.coHostId = coHostUid ?? undefined;
    saveDB(db);
    emit("outings");
    if (coHostUid) {
      pushNotification(db, coHostUid, {
        type: "outing_request_accepted",
        title: "You're a co-host! 🎉",
        body: `${db.users[uidVal]?.name ?? "The leader"} made you co-host of "${outing.title}".`,
        linkTo: `/outings/${outing.id}`,
      });
      emit(`notifications:${coHostUid}`);
    }
  },

  async addOutingPhoto(outingId, uidVal, photoUrl) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || !outing.memberIds.includes(uidVal)) return;
    outing.photoAlbum.push(photoUrl);
    saveDB(db);
    emit("outings");
  },

  async submitOutingRating(outingId, uidVal, rating) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || !outing.memberIds.includes(uidVal)) return;
    db.ratings = db.ratings.filter((r) => !(r.outingId === outingId && r.uid === uidVal));
    db.ratings.push({
      id: genId("rating"),
      outingId,
      uid: uidVal,
      venueRating: rating.venueRating,
      vibeRating: rating.vibeRating,
      comment: rating.comment,
      createdAt: Date.now(),
    });
    saveDB(db);
    emit(`ratings:${outingId}`);
  },

  async getOutingRatings(outingId) {
    const db = loadDB();
    return db.ratings.filter((r) => r.outingId === outingId);
  },

  async getLeaderReputation(uidVal) {
    const db = loadDB();
    const myOutingIds = new Set(
      Object.values(db.outings).filter((o) => o.leaderId === uidVal).map((o) => o.id)
    );
    const ratings = db.ratings.filter((r) => myOutingIds.has(r.outingId));
    if (ratings.length === 0) return { avgVenueRating: 0, avgVibeRating: 0, ratingCount: 0 };
    const avgVenueRating = ratings.reduce((s, r) => s + r.venueRating, 0) / ratings.length;
    const avgVibeRating = ratings.reduce((s, r) => s + r.vibeRating, 0) / ratings.length;
    return { avgVenueRating, avgVibeRating, ratingCount: ratings.length };
  },

  async addExpense(outingId, uidVal, description, amount, splitAmongUids) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing || !outing.memberIds.includes(uidVal)) throw new Error("Not a member of this outing.");
    const expense: Expense = {
      id: genId("expense"),
      outingId,
      description,
      amount,
      paidBy: uidVal,
      splitAmongUids,
      createdAt: Date.now(),
    };
    db.expenses.push(expense);
    saveDB(db);
    emit(`expenses:${outingId}`);
    return expense;
  },

  subscribeExpenses(outingId, cb) {
    const handler = () => {
      const db = loadDB();
      cb(db.expenses.filter((e) => e.outingId === outingId).sort((a, b) => a.createdAt - b.createdAt));
    };
    handler();
    return subscribe(`expenses:${outingId}`, handler);
  },

  async createPoll(outingId, chatId, uidVal, question, options) {
    const db = loadDB();
    const poll: OutingPoll = {
      id: genId("poll"),
      outingId,
      chatId,
      question,
      options: options.map((text) => ({ id: genId("opt"), text, votes: [] })),
      createdBy: uidVal,
      createdAt: Date.now(),
    };
    db.polls.push(poll);
    const chat = db.chats[chatId];
    if (chat) {
      const message: ChatMessage = {
        id: genId("msg"),
        chatId,
        senderId: uidVal,
        text: `📊 ${question}`,
        createdAt: Date.now(),
        pollId: poll.id,
      };
      if (!db.messages[chatId]) db.messages[chatId] = [];
      db.messages[chatId].push(message);
      chat.lastMessage = `📊 ${question}`;
      chat.lastMessageAt = message.createdAt;
    }
    saveDB(db);
    emit(`polls:${chatId}`);
    emit(`messages:${chatId}`);
    return poll;
  },

  async votePoll(pollId, uidVal, optionId) {
    const db = loadDB();
    const poll = db.polls.find((p) => p.id === pollId);
    if (!poll) return;
    for (const opt of poll.options) {
      opt.votes = opt.votes.filter((v) => v !== uidVal);
    }
    const target = poll.options.find((o) => o.id === optionId);
    if (target) target.votes.push(uidVal);
    saveDB(db);
    emit(`polls:${poll.chatId}`);
  },

  subscribePolls(chatId, cb) {
    const handler = () => {
      const db = loadDB();
      cb(db.polls.filter((p) => p.chatId === chatId).sort((a, b) => a.createdAt - b.createdAt));
    };
    handler();
    return subscribe(`polls:${chatId}`, handler);
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

  async sendMessage(chatId, senderId, text, options) {
    const db = loadDB();
    const chat = db.chats[chatId];
    if (!chat) return;
    const message: ChatMessage = {
      id: genId("msg"),
      chatId,
      senderId,
      text,
      createdAt: Date.now(),
      imageUrl: options?.imageUrl,
      audioUrl: options?.audioUrl,
      stickerId: options?.stickerId,
      mentions: options?.mentions,
    };
    if (!db.messages[chatId]) db.messages[chatId] = [];
    db.messages[chatId].push(message);
    const preview = options?.imageUrl ? "📷 Photo" : options?.audioUrl ? "🎙️ Voice message" : options?.stickerId ? "Sent a sticker" : text;
    chat.lastMessage = preview;
    chat.lastMessageAt = message.createdAt;

    for (const memberUid of chat.memberIds) {
      if (memberUid === senderId) continue;
      const sender = db.users[senderId];
      const mentioned = message.mentions?.includes(memberUid);
      pushNotification(db, memberUid, {
        type: "new_message",
        title: mentioned ? `${sender?.name ?? "Someone"} mentioned you` : sender?.name ?? "New message",
        body: preview,
        linkTo: `/chats/${chatId}`,
      });
    }

    saveDB(db);
    emit(`messages:${chatId}`);
    emit(`typing:${chatId}`);
    for (const memberUid of chat.memberIds) {
      emit(`chats:${memberUid}`);
      emit(`notifications:${memberUid}`);
    }
  },

  async markMessageRead(chatId, messageId, uidVal) {
    const db = loadDB();
    const messages = db.messages[chatId];
    const message = messages?.find((m) => m.id === messageId);
    if (!message) return;
    message.readBy ??= [];
    if (!message.readBy.includes(uidVal)) {
      message.readBy.push(uidVal);
      saveDB(db);
      emit(`messages:${chatId}`);
    }
  },

  async togglePinMessage(chatId, messageId, uidVal) {
    const db = loadDB();
    const chat = db.chats[chatId];
    const message = db.messages[chatId]?.find((m) => m.id === messageId);
    if (!chat || !message || !chat.memberIds.includes(uidVal)) return;
    message.pinned = !message.pinned;
    saveDB(db);
    emit(`messages:${chatId}`);
  },

  async setTyping(chatId, uidVal, isTyping) {
    if (isTyping) {
      typingState.set(`${chatId}:${uidVal}`, Date.now() + 4000);
    } else {
      typingState.delete(`${chatId}:${uidVal}`);
    }
    emit(`typing:${chatId}`);
  },

  subscribeTyping(chatId, cb) {
    const handler = () => {
      const now = Date.now();
      const uids: string[] = [];
      for (const [key, expiresAt] of typingState.entries()) {
        if (!key.startsWith(`${chatId}:`)) continue;
        if (expiresAt < now) {
          typingState.delete(key);
          continue;
        }
        uids.push(key.slice(chatId.length + 1));
      }
      cb(uids);
    };
    handler();
    const unsubscribe = subscribe(`typing:${chatId}`, handler);
    const interval = setInterval(handler, 1500);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
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
    const reportId = genId("report");
    db.reports.push({ id: reportId, reporterId, reportedId, reason, status: "open", createdAt: Date.now() });
    saveDB(db);
    // Simulate a review pipeline picking it up shortly after, for status transparency.
    setTimeout(() => {
      const latest = loadDB();
      const report = latest.reports.find((r) => r.id === reportId);
      if (report && report.status === "open") {
        report.status = "reviewing";
        saveDB(latest);
        emit(`reports:${reporterId}`);
      }
    }, 5000);
  },

  async getMyReports(reporterId) {
    const db = loadDB();
    return db.reports.filter((r) => r.reporterId === reporterId).sort((a, b) => b.createdAt - a.createdAt);
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

  async requestIdVerification(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return;
    me.idVerificationStatus = "pending";
    saveDB(db);
    emit("auth");
    // Mock review pipeline - in production this would go through a real ID verification vendor.
    setTimeout(() => {
      const latest = loadDB();
      const user = latest.users[uidVal];
      if (user && user.idVerificationStatus === "pending") {
        user.idVerificationStatus = "verified";
        pushNotification(latest, uidVal, {
          type: "safety_checkin",
          title: "ID verified ✅",
          body: "Your government ID is verified. You're now Highly Trusted tier.",
        });
        saveDB(latest);
        emit("auth");
        emit(`notifications:${uidVal}`);
      }
    }, 4000);
  },

  async requestVideoVerification(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return;
    me.videoVerificationStatus = "pending";
    saveDB(db);
    emit("auth");
    setTimeout(() => {
      const latest = loadDB();
      const user = latest.users[uidVal];
      if (user && user.videoVerificationStatus === "pending") {
        user.videoVerificationStatus = "verified";
        pushNotification(latest, uidVal, {
          type: "safety_checkin",
          title: "Video verified ✅",
          body: "Your verification video was reviewed. Thanks for helping keep Partizo real.",
        });
        saveDB(latest);
        emit("auth");
        emit(`notifications:${uidVal}`);
      }
    }, 4000);
  },

  async runPhotoCheck(uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) return;
    // Heuristic mock check, NOT a real ML/AI pipeline - always clears in the demo,
    // mirroring how verification auto-approves in mock mode.
    me.photoCheckStatus = "clear";
    saveDB(db);
    emit("auth");
  },

  async startSafetyCheckin(outingId, uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    const outing = db.outings[outingId];
    if (!me || !outing) throw new Error("Outing or user not found.");

    const checkin: SafetyCheckin = {
      id: genId("checkin"),
      outingId,
      uid: uidVal,
      status: "shared",
      emergencyContactName: me.emergencyContactName,
      emergencyContactPhone: me.emergencyContactPhone,
      sharedAt: Date.now(),
    };
    db.safetyCheckins = db.safetyCheckins.filter(
      (c) => !(c.outingId === outingId && c.uid === uidVal)
    );
    db.safetyCheckins.push(checkin);
    saveDB(db);
    emit(`safety:${outingId}:${uidVal}`);
    return checkin;
  },

  async confirmSafe(outingId, uidVal) {
    const db = loadDB();
    const checkin = db.safetyCheckins.find((c) => c.outingId === outingId && c.uid === uidVal);
    if (!checkin) return;
    checkin.status = "confirmed_safe";
    checkin.confirmedAt = Date.now();
    saveDB(db);
    emit(`safety:${outingId}:${uidVal}`);
  },

  async getSafetyCheckin(outingId, uidVal) {
    const db = loadDB();
    const checkin = db.safetyCheckins.find((c) => c.outingId === outingId && c.uid === uidVal);
    if (!checkin) return null;
    const outing = db.outings[outingId];
    if (checkin.status === "shared" && outing && outing.dateTime + 3 * 60 * 60 * 1000 < Date.now()) {
      checkin.status = "overdue";
      saveDB(db);
    }
    return checkin;
  },

  async triggerSOS(outingId, uidVal) {
    const db = loadDB();
    const me = db.users[uidVal];
    if (!me) throw new Error("User not found.");
    const checkinId = genId("checkin");
    const checkin: SafetyCheckin = {
      id: checkinId,
      outingId,
      uid: uidVal,
      status: "overdue",
      emergencyContactName: me.emergencyContactName,
      emergencyContactPhone: me.emergencyContactPhone,
      sharedAt: Date.now(),
    };
    db.safetyCheckins = db.safetyCheckins.filter((c) => !(c.outingId === outingId && c.uid === uidVal));
    db.safetyCheckins.push(checkin);
    pushNotification(db, uidVal, {
      type: "sos_alert",
      title: "SOS sent",
      body: me.emergencyContactName
        ? `We've flagged this to notify ${me.emergencyContactName}. Stay safe - call them directly if you can.`
        : "No emergency contact is set - add one in your profile so SOS can reach someone.",
    });
    saveDB(db);
    emit(`safety:${outingId}:${uidVal}`);
    emit(`notifications:${uidVal}`);
    return checkin;
  },

  async startLiveLocation(outingId, uidVal, lat, lng, durationMinutes) {
    const db = loadDB();
    const share: LiveLocationShare = {
      id: `${outingId}_${uidVal}`,
      outingId,
      uid: uidVal,
      lat,
      lng,
      expiresAt: Date.now() + durationMinutes * 60 * 1000,
      updatedAt: Date.now(),
    };
    db.liveLocations = db.liveLocations.filter((s) => !(s.outingId === outingId && s.uid === uidVal));
    db.liveLocations.push(share);
    saveDB(db);
    emit(`liveLocation:${outingId}:${uidVal}`);
    return share;
  },

  async updateLiveLocation(outingId, uidVal, lat, lng) {
    const db = loadDB();
    const share = db.liveLocations.find((s) => s.outingId === outingId && s.uid === uidVal);
    if (!share || share.expiresAt < Date.now()) return;
    share.lat = lat;
    share.lng = lng;
    share.updatedAt = Date.now();
    saveDB(db);
    emit(`liveLocation:${outingId}:${uidVal}`);
  },

  async stopLiveLocation(outingId, uidVal) {
    const db = loadDB();
    db.liveLocations = db.liveLocations.filter((s) => !(s.outingId === outingId && s.uid === uidVal));
    saveDB(db);
    emit(`liveLocation:${outingId}:${uidVal}`);
  },

  subscribeLiveLocation(outingId, uidVal, cb) {
    const handler = () => {
      const db = loadDB();
      const share = db.liveLocations.find((s) => s.outingId === outingId && s.uid === uidVal);
      cb(share && share.expiresAt > Date.now() ? share : null);
    };
    handler();
    return subscribe(`liveLocation:${outingId}:${uidVal}`, handler);
  },

  async getOutingAttendees(outingId, uidVal) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return [];
    return outing.memberIds
      .filter((id) => id !== uidVal)
      .map((id) => db.users[id])
      .filter((u): u is UserProfile => Boolean(u));
  },

  async submitReconnectPicks(outingId, uidVal, pickedUids) {
    const db = loadDB();
    const outing = db.outings[outingId];
    if (!outing) return [];

    db.reconnectPicks = db.reconnectPicks.filter(
      (p) => !(p.outingId === outingId && p.fromUid === uidVal)
    );
    for (const toUid of pickedUids) {
      db.reconnectPicks.push({ id: genId("pick"), outingId, fromUid: uidVal, toUid, createdAt: Date.now() });
    }
    if (!outing.reconnectSubmittedUids.includes(uidVal)) {
      outing.reconnectSubmittedUids.push(uidVal);
    }

    const newMatches: Match[] = [];
    for (const toUid of pickedUids) {
      const mutual = db.reconnectPicks.some(
        (p) => p.outingId === outingId && p.fromUid === toUid && p.toUid === uidVal
      );
      if (!mutual) continue;
      const alreadyMatched = db.matches.some(
        (m) => m.userIds.includes(uidVal) && m.userIds.includes(toUid)
      );
      if (alreadyMatched) continue;

      const me = db.users[uidVal];
      const other = db.users[toUid];
      if (!me || !other) continue;
      const chat = ensureChat(db, [uidVal, toUid], "match", `${me.name} & ${other.name}`);
      const vibeScore = computeVibeScore(me, other);
      const match: Match = {
        id: genId("match"),
        userIds: [uidVal, toUid],
        chatId: chat.id,
        vibeScore,
        createdAt: Date.now(),
      };
      db.matches.push(match);
      newMatches.push(match);

      pushNotification(db, uidVal, {
        type: "reconnect_match",
        title: "You both want to stay in touch! 🎉",
        body: `You and ${other.name} matched after "${outing.title}". Say hi!`,
        linkTo: `/chats/${chat.id}`,
      });
      pushNotification(db, toUid, {
        type: "reconnect_match",
        title: "You both want to stay in touch! 🎉",
        body: `You and ${me.name} matched after "${outing.title}". Say hi!`,
        linkTo: `/chats/${chat.id}`,
      });
    }

    saveDB(db);
    emit("outings");
    for (const toUid of pickedUids) {
      emit(`notifications:${toUid}`);
      emit(`chats:${toUid}`);
    }
    emit(`notifications:${uidVal}`);
    emit(`chats:${uidVal}`);
    return newMatches;
  },
};
