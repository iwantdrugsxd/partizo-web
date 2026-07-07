import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
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
  Report,
  SafetyCheckin,
  UserProfile,
} from "@/lib/types";
import { computeTraitsFromAnswers, computeVibeScore, personalityLabel, sharedTags } from "@/lib/vibe";
import { coordsForCity, distanceKm } from "@/lib/geo";
import {
  CreateOutingInput,
  DataProvider,
  DeckCandidate,
  DeckFilters,
  OnboardingData,
  SwipeResult,
} from "@/lib/data/provider";

function requireDb() {
  if (!db || !auth) {
    throw new Error(
      "Firebase is not configured. Fill in .env.local with your Firebase project keys and set NEXT_PUBLIC_DATA_MODE=firebase."
    );
  }
  return { db, auth };
}

function requireStorage() {
  if (!storage) {
    throw new Error(
      "Firebase is not configured. Fill in .env.local with your Firebase project keys and set NEXT_PUBLIC_DATA_MODE=firebase."
    );
  }
  return storage;
}

/** Client-generated id for cases where we need the id before the Firestore doc exists (e.g. a recurrence series id). */
function genFirebaseId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function docToUser(data: DocumentData, uid: string): UserProfile {
  return { ...(data as UserProfile), uid };
}

async function fetchUser(uid: string): Promise<UserProfile | null> {
  const { db } = requireDb();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return docToUser(snap.data(), uid);
}

async function pushNotification(
  recipientUid: string,
  n: Omit<AppNotification, "id" | "uid" | "read" | "createdAt">
) {
  const { db } = requireDb();
  await addDoc(collection(db, "users", recipientUid, "notifications"), {
    ...n,
    uid: recipientUid,
    read: false,
    createdAt: Date.now(),
  });
}

/**
 * Lazily flips an outing to "completed" once its dateTime has passed. Computed
 * synchronously for the caller; persists the flip to Firestore best-effort
 * without blocking the read.
 */
function refreshOutingStatus(id: string, outing: Outing): Outing {
  if ((outing.status === "live" || outing.status === "full") && outing.dateTime < Date.now()) {
    outing.status = "completed";
    const { db } = requireDb();
    void updateDoc(doc(db, "outings", id), { status: "completed" });
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

/**
 * Firestore rejects `undefined` field values (unlike the mock provider, where JSON
 * serialization silently drops them) - this strips them so spreading an object with
 * optional fields (lat/lng, recurrence, emergencyContact*) is safe to write.
 */
function withoutUndefined<T extends object>(obj: T): T {
  const clean = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(clean)) {
    if (clean[key] === undefined) delete clean[key];
  }
  return clean as T;
}

export const firebaseProvider: DataProvider = {
  async signUp(email, password, name) {
    const { auth, db } = requireDb();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateAuthProfile(cred.user, { displayName: name });
    const profile: UserProfile = {
      uid: cred.user.uid,
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
    await setDoc(doc(db, "users", cred.user.uid), profile);
    return profile;
  },

  async signIn(email, password) {
    const { auth } = requireDb();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchUser(cred.user.uid);
    if (!profile) throw new Error("No profile found for this account.");
    return profile;
  },

  async signOutUser() {
    const { auth } = requireDb();
    await signOut(auth);
  },

  async getCurrentUser() {
    const { auth } = requireDb();
    const current = auth.currentUser;
    if (!current) return null;
    return fetchUser(current.uid);
  },

  onAuthChange(cb) {
    const { auth } = requireDb();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        cb(null);
        return;
      }
      cb(await fetchUser(user.uid));
    });
  },

  async getUser(uid) {
    return fetchUser(uid);
  },

  async updateProfile(uid, partial) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), partial as DocumentData);
  },

  async uploadPhoto(uid, file) {
    const storageRef = ref(requireStorage(), `users/${uid}/photos/${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  },

  async completeOnboarding(uid, data: OnboardingData) {
    const { db } = requireDb();
    const traits = computeTraitsFromAnswers(data.quizAnswers);
    const coords = coordsForCity(data.city);
    await updateDoc(doc(db, "users", uid), {
      ...data,
      traits,
      personalityLabel: personalityLabel(traits),
      onboardingComplete: true,
      ...(coords ?? {}),
    } as DocumentData);
  },

  async getDeck(uid, filters?: DeckFilters) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    if (!me) return [];

    const swipesSnap = await getDocs(
      query(collection(db, "swipes"), where("fromUid", "==", uid))
    );
    const swipedIds = new Set(swipesSnap.docs.map((d) => d.data().toUid as string));

    const usersSnap = await getDocs(collection(db, "users"));
    let candidates: DeckCandidate[] = [];
    usersSnap.forEach((d) => {
      if (d.id === uid) return;
      if (swipedIds.has(d.id)) return;
      const u = docToUser(d.data(), d.id);
      if (!u.onboardingComplete) return;
      if (me.blockedUserIds.includes(u.uid) || u.blockedUserIds?.includes(uid)) return;
      if (me.showMePreference !== "everyone" && u.gender !== me.showMePreference) return;
      if (filters?.minAge !== undefined && u.age < filters.minAge) return;
      if (filters?.maxAge !== undefined && u.age > filters.maxAge) return;
      if (filters?.requiredTags?.length && !filters.requiredTags.some((t) => u.tags.includes(t))) return;
      const dKm =
        me.lat !== undefined && me.lng !== undefined && u.lat !== undefined && u.lng !== undefined
          ? Math.round(distanceKm({ lat: me.lat, lng: me.lng }, { lat: u.lat, lng: u.lng }))
          : undefined;
      candidates.push({ ...u, vibeScore: computeVibeScore(me, u), sharedTags: sharedTags(me.tags, u.tags), distanceKm: dKm });
    });
    if (filters?.minVibeScore !== undefined) {
      candidates = candidates.filter((c) => c.vibeScore >= filters.minVibeScore!);
    }
    if (filters?.maxDistanceKm !== undefined) {
      candidates = candidates.filter((c) => c.distanceKm === undefined || c.distanceKm <= filters.maxDistanceKm!);
    }
    candidates.sort((a, b) => b.vibeScore - a.vibeScore);
    return candidates;
  },

  async undoLastSwipe(uid) {
    const { db } = requireDb();
    const swipesSnap = await getDocs(
      query(collection(db, "swipes"), where("fromUid", "==", uid))
    );
    const docs = swipesSnap.docs.sort((a, b) => (b.data().createdAt ?? 0) - (a.data().createdAt ?? 0));
    const last = docs[0];
    if (!last) return null;
    const toUid = last.data().toUid as string;

    const other = await fetchUser(toUid);
    const me = await fetchUser(uid);
    if (!other || !me) return null;

    const matchesSnap = await getDocs(
      query(collection(db, "matches"), where("userIds", "array-contains", uid))
    );
    const matchDoc = matchesSnap.docs.find((d) => (d.data().userIds as string[]).includes(toUid));
    if (matchDoc) {
      const chatId = matchDoc.data().chatId as string;
      await deleteDoc(doc(db, "chats", chatId));
      await deleteDoc(doc(db, "matches", matchDoc.id));
    }

    await deleteDoc(last.ref);
    return { ...other, vibeScore: computeVibeScore(me, other), sharedTags: sharedTags(me.tags, other.tags) };
  },

  async getLikedByUsers(uid) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    if (!me) return [];
    const [likedMeSnap, myActionsSnap] = await Promise.all([
      getDocs(query(collection(db, "swipes"), where("toUid", "==", uid), where("direction", "==", "like"))),
      getDocs(query(collection(db, "swipes"), where("fromUid", "==", uid))),
    ]);
    const alreadyActedOn = new Set(myActionsSnap.docs.map((d) => d.data().toUid as string));
    const admirerIds = likedMeSnap.docs
      .map((d) => d.data().fromUid as string)
      .filter((id) => !alreadyActedOn.has(id));
    const profiles = await Promise.all(admirerIds.map((id) => fetchUser(id)));
    return profiles
      .filter((u): u is UserProfile => Boolean(u && u.onboardingComplete))
      .map((u) => ({ ...u, vibeScore: computeVibeScore(me, u), sharedTags: sharedTags(me.tags, u.tags) }));
  },

  async recordSwipe(fromUid, toUid, direction): Promise<SwipeResult> {
    const { db } = requireDb();
    await setDoc(doc(db, "swipes", `${fromUid}_${toUid}`), {
      fromUid,
      toUid,
      direction,
      createdAt: Date.now(),
    });

    if (direction !== "like") return { matched: false };

    const reciprocalSnap = await getDoc(doc(db, "swipes", `${toUid}_${fromUid}`));
    if (!reciprocalSnap.exists() || reciprocalSnap.data().direction !== "like") {
      return { matched: false };
    }

    const me = await fetchUser(fromUid);
    const other = await fetchUser(toUid);
    if (!me || !other) return { matched: false };

    const chatRef = await addDoc(collection(db, "chats"), {
      type: "match",
      memberIds: [fromUid, toUid],
      title: `${me.name} & ${other.name}`,
      createdAt: Date.now(),
    });
    await addDoc(collection(db, "chats", chatRef.id, "messages"), {
      chatId: chatRef.id,
      senderId: "system",
      text: "You matched! Say hi 👋",
      createdAt: Date.now(),
      system: true,
    });

    const vibeScore = computeVibeScore(me, other);
    const matchRef = await addDoc(collection(db, "matches"), {
      userIds: [fromUid, toUid],
      chatId: chatRef.id,
      vibeScore,
      createdAt: Date.now(),
    });

    await pushNotification(fromUid, {
      type: "new_match",
      title: "It's a vibe match! 🎉",
      body: `You and ${other.name} vibe at ${vibeScore}%. Say hi!`,
      linkTo: `/chats/${chatRef.id}`,
    });
    await pushNotification(toUid, {
      type: "new_match",
      title: "It's a vibe match! 🎉",
      body: `You and ${me.name} vibe at ${vibeScore}%. Say hi!`,
      linkTo: `/chats/${chatRef.id}`,
    });

    const match: Match = { id: matchRef.id, userIds: [fromUid, toUid], chatId: chatRef.id, vibeScore, createdAt: Date.now() };
    return { matched: true, match };
  },

  async getMatches(uid) {
    const { db } = requireDb();
    const snap = await getDocs(query(collection(db, "matches"), where("userIds", "array-contains", uid)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Match, "id">) }));
  },

  async createOuting(input: CreateOutingInput) {
    const { db } = requireDb();
    const instanceCount = input.recurrence ? Math.max(1, input.recurrence.count) : 1;
    const seriesId = input.recurrence ? genFirebaseId() : undefined;
    let firstOuting: Outing | null = null;

    for (let i = 0; i < instanceCount; i++) {
      const base = withoutUndefined({
        ...input,
        dateTime: input.dateTime + i * 7 * 24 * 60 * 60 * 1000,
        status: "live" as const,
        requests: [],
        memberIds: [input.leaderId],
        chatId: null,
        reminderSent: false,
        reconnectSubmittedUids: [],
        photoAlbum: [],
        recurrence: input.recurrence && seriesId ? { freq: input.recurrence.freq, count: instanceCount, seriesId } : undefined,
        createdAt: Date.now(),
      });
      const ref = await addDoc(collection(db, "outings"), base);
      if (i === 0) firstOuting = { id: ref.id, ...base } as Outing;
    }

    if (input.visibility === "private" && input.invitedUserIds.length > 0 && firstOuting) {
      const leader = await fetchUser(input.leaderId);
      for (const invitedUid of input.invitedUserIds) {
        await pushNotification(invitedUid, {
          type: "outing_request_received",
          title: "You're invited to a private outing",
          body: `${leader?.name ?? "Someone"} invited you to "${firstOuting.title}"`,
          linkTo: `/outings/${firstOuting.id}`,
        });
      }
    }
    return firstOuting!;
  },

  async getLiveOutings(uid, filters) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    const snap = await getDocs(
      query(collection(db, "outings"), where("status", "in", ["live", "full"]))
    );
    const q = filters?.query?.trim().toLowerCase();
    const outings = snap.docs
      .map((d) => refreshOutingStatus(d.id, { id: d.id, ...(d.data() as Omit<Outing, "id">) }))
      .filter((o) => o.status === "live" || o.status === "full")
      .filter((o) => o.leaderId !== uid)
      .filter((o) => !q || o.title.toLowerCase().includes(q) || o.description.toLowerCase().includes(q))
      .filter((o) => !filters?.category || o.category === filters.category)
      .filter((o) => filters?.fromDate === undefined || o.dateTime >= filters.fromDate)
      .filter((o) => filters?.toDate === undefined || o.dateTime <= filters.toDate)
      .filter((o) => o.visibility === "public" || o.invitedUserIds.includes(uid));
    if (!me) return outings;
    const leaders = await Promise.all(outings.map((o) => fetchUser(o.leaderId)));
    return outings
      .map((o, i) => ({ o, score: leaders[i] ? computeVibeScore(me, leaders[i]!) : 0 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.o);
  },

  async getMyOutings(uid) {
    const { db } = requireDb();
    const leaderSnap = await getDocs(query(collection(db, "outings"), where("leaderId", "==", uid)));
    const memberSnap = await getDocs(
      query(collection(db, "outings"), where("memberIds", "array-contains", uid))
    );
    const map = new Map<string, Outing>();
    [...leaderSnap.docs, ...memberSnap.docs].forEach((d) => {
      map.set(d.id, refreshOutingStatus(d.id, { id: d.id, ...(d.data() as Omit<Outing, "id">) }));
    });
    return Array.from(map.values());
  },

  async getOuting(id) {
    const { db } = requireDb();
    const snap = await getDoc(doc(db, "outings", id));
    if (!snap.exists()) return null;
    return refreshOutingStatus(id, { id: snap.id, ...(snap.data() as Omit<Outing, "id">) });
  },

  subscribeOuting(id, cb) {
    const { db } = requireDb();
    return onSnapshot(doc(db, "outings", id), (snap) => {
      cb(snap.exists() ? refreshOutingStatus(id, { id: snap.id, ...(snap.data() as Omit<Outing, "id">) }) : null);
    });
  },

  async requestToJoin(outingId, uid, guestCount) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = snap.data() as Outing;
    if (outing.requests.some((r) => r.uid === uid) || outing.memberIds.includes(uid)) return;
    if (outing.visibility === "private" && !outing.invitedUserIds.includes(uid)) return;

    const isWaitlisted = occupiedSeats(outing) >= outing.capacity;
    await updateDoc(outingRef, {
      requests: arrayUnion({
        uid,
        status: isWaitlisted ? "waitlisted" : "pending",
        requestedAt: Date.now(),
        guestCount: guestCount && guestCount > 0 ? guestCount : null,
      }),
    });
    const requester = await fetchUser(uid);
    await pushNotification(outing.leaderId, {
      type: "outing_request_received",
      title: isWaitlisted ? "New outing waitlist request" : "New outing request",
      body: isWaitlisted
        ? `${requester?.name ?? "Someone"} joined the waitlist for "${outing.title}" (it's full)`
        : `${requester?.name ?? "Someone"} wants to join "${outing.title}"`,
      linkTo: `/outings/${outingId}`,
    });
  },

  async respondToRequest(outingId, targetUid, accept) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;

    const req = outing.requests.find((r) => r.uid === targetUid);
    if (accept && occupiedSeats(outing) + (req?.guestCount ?? 0) >= outing.capacity) {
      const requests = outing.requests.map((r) => (r.uid === targetUid ? { ...r, status: "waitlisted" as const } : r));
      await updateDoc(outingRef, { requests });
      return;
    }

    const requests = outing.requests.map((r) => (r.uid === targetUid ? { ...r, status: accept ? "accepted" as const : "rejected" as const } : r));

    let chatId = outing.chatId;
    const memberIds = [...outing.memberIds];

    if (accept) {
      if (!memberIds.includes(targetUid)) memberIds.push(targetUid);
      if (!chatId) {
        const chatRef = await addDoc(collection(db, "chats"), {
          type: "outing",
          memberIds: [outing.leaderId],
          outingId,
          title: outing.title,
          createdAt: Date.now(),
        });
        await addDoc(collection(db, "chats", chatRef.id, "messages"), {
          chatId: chatRef.id,
          senderId: "system",
          text: "Outing crew assembled - coordinate your plan here 🎉",
          createdAt: Date.now(),
          system: true,
        });
        chatId = chatRef.id;
      }
      await updateDoc(doc(db, "chats", chatId), { memberIds: arrayUnion(targetUid) });
    }

    const status = occupiedSeats({ ...outing, memberIds, requests }) >= outing.capacity ? "full" : outing.status;

    await updateDoc(outingRef, { requests, memberIds, chatId, status });

    await pushNotification(targetUid, {
      type: accept ? "outing_request_accepted" : "outing_request_rejected",
      title: accept ? "You're in! 🎉" : "Request declined",
      body: accept
        ? `Your request to join "${outing.title}" was accepted. Head to the group chat!`
        : `Your request to join "${outing.title}" wasn't accepted this time.`,
      linkTo: accept && chatId ? `/chats/${chatId}` : `/outings`,
    });
  },

  async leaveOuting(outingId, uid) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;
    if (outing.leaderId === uid) return;

    let memberIds = outing.memberIds.filter((id) => id !== uid);
    // Drop their own request record so they're free to request to join again later.
    let requests = outing.requests.filter((r) => r.uid !== uid);
    const status =
      outing.status === "full" && occupiedSeats({ ...outing, memberIds, requests }) < outing.capacity
        ? "live"
        : outing.status;
    if (outing.chatId) {
      await updateDoc(doc(db, "chats", outing.chatId), { memberIds: arrayRemove(uid) });
    }

    const nextInLine = requests
      .filter((r) => r.status === "waitlisted")
      .sort((a, b) => a.requestedAt - b.requestedAt)[0];
    if (nextInLine && occupiedSeats({ ...outing, memberIds, requests }) + (nextInLine.guestCount ?? 0) < outing.capacity) {
      requests = requests.map((r) => (r.uid === nextInLine.uid ? { ...r, status: "accepted" as const } : r));
      memberIds = [...memberIds, nextInLine.uid];
      if (outing.chatId) await updateDoc(doc(db, "chats", outing.chatId), { memberIds: arrayUnion(nextInLine.uid) });
      await pushNotification(nextInLine.uid, {
        type: "outing_request_accepted",
        title: "A spot opened up! 🎉",
        body: `You're in for "${outing.title}" - a spot opened up on the waitlist.`,
        linkTo: outing.chatId ? `/chats/${outing.chatId}` : `/outings`,
      });
    }

    await updateDoc(outingRef, { memberIds, requests, status });

    const leaver = await fetchUser(uid);
    await pushNotification(outing.leaderId, {
      type: "outing_request_rejected",
      title: "Someone left your outing",
      body: `${leaver?.name ?? "Someone"} left "${outing.title}".`,
      linkTo: `/outings/${outing.id}`,
    });
  },

  async checkOutingReminders(uid) {
    const outings = await firebaseProvider.getMyOutings(uid);
    const { db } = requireDb();
    const upcoming = outings.filter(
      (o) =>
        o.memberIds.includes(uid) &&
        !o.reminderSent &&
        o.dateTime > Date.now() &&
        o.dateTime - Date.now() < 24 * 60 * 60 * 1000
    );
    for (const outing of upcoming) {
      await updateDoc(doc(db, "outings", outing.id), { reminderSent: true });
      await pushNotification(uid, {
        type: "outing_reminder",
        title: "Outing starts soon",
        body: `"${outing.title}" is coming up. Don't forget to share your outing status for safety.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
  },

  async cancelOuting(outingId, uid, reason) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;
    if (outing.leaderId !== uid) return;
    await updateDoc(outingRef, { status: "cancelled", cancelReason: reason ?? null });
    for (const memberUid of outing.memberIds) {
      if (memberUid === uid) continue;
      await pushNotification(memberUid, {
        type: "outing_cancelled",
        title: "Outing cancelled",
        body: reason ? `"${outing.title}" was cancelled: ${reason}` : `"${outing.title}" was cancelled by the host.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
  },

  async rescheduleOuting(outingId, uid, newDateTime) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;
    if (outing.leaderId !== uid) return;
    const status = outing.status === "completed" ? (occupiedSeats(outing) >= outing.capacity ? "full" : "live") : outing.status;
    await updateDoc(outingRef, { dateTime: newDateTime, reminderSent: false, status });
    for (const memberUid of outing.memberIds) {
      if (memberUid === uid) continue;
      await pushNotification(memberUid, {
        type: "outing_cancelled",
        title: "Outing rescheduled",
        body: `"${outing.title}" moved to ${new Date(newDateTime).toLocaleString()}.`,
        linkTo: `/outings/${outing.id}`,
      });
    }
  },

  async setCoHost(outingId, uid, coHostUid) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;
    if (outing.leaderId !== uid) return;
    if (coHostUid && !outing.memberIds.includes(coHostUid)) return;
    await updateDoc(outingRef, { coHostId: coHostUid ?? null });
    if (coHostUid) {
      const leader = await fetchUser(uid);
      await pushNotification(coHostUid, {
        type: "outing_request_accepted",
        title: "You're a co-host! 🎉",
        body: `${leader?.name ?? "The leader"} made you co-host of "${outing.title}".`,
        linkTo: `/outings/${outing.id}`,
      });
    }
  },

  async addOutingPhoto(outingId, uid, photoUrl) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists() || !(snap.data() as Outing).memberIds.includes(uid)) return;
    await updateDoc(outingRef, { photoAlbum: arrayUnion(photoUrl) });
  },

  async submitOutingRating(outingId, uid, rating) {
    const { db } = requireDb();
    const outingSnap = await getDoc(doc(db, "outings", outingId));
    if (!outingSnap.exists() || !(outingSnap.data() as Outing).memberIds.includes(uid)) return;
    await setDoc(doc(db, "ratings", `${outingId}_${uid}`), {
      outingId,
      uid,
      venueRating: rating.venueRating,
      vibeRating: rating.vibeRating,
      comment: rating.comment ?? null,
      createdAt: Date.now(),
    });
  },

  async getOutingRatings(outingId) {
    const { db } = requireDb();
    const snap = await getDocs(query(collection(db, "ratings"), where("outingId", "==", outingId)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OutingRating, "id">) }));
  },

  async getLeaderReputation(uid) {
    const { db } = requireDb();
    const outingsSnap = await getDocs(query(collection(db, "outings"), where("leaderId", "==", uid)));
    const outingIds = new Set(outingsSnap.docs.map((d) => d.id));
    if (outingIds.size === 0) return { avgVenueRating: 0, avgVibeRating: 0, ratingCount: 0 };
    const ratingsSnap = await getDocs(collection(db, "ratings"));
    const ratings = ratingsSnap.docs
      .map((d) => d.data() as { outingId: string; venueRating: number; vibeRating: number })
      .filter((r) => outingIds.has(r.outingId));
    if (ratings.length === 0) return { avgVenueRating: 0, avgVibeRating: 0, ratingCount: 0 };
    const avgVenueRating = ratings.reduce((s, r) => s + r.venueRating, 0) / ratings.length;
    const avgVibeRating = ratings.reduce((s, r) => s + r.vibeRating, 0) / ratings.length;
    return { avgVenueRating, avgVibeRating, ratingCount: ratings.length };
  },

  async addExpense(outingId, uid, description, amount, splitAmongUids) {
    const { db } = requireDb();
    const ref = await addDoc(collection(db, "expenses"), {
      outingId,
      description,
      amount,
      paidBy: uid,
      splitAmongUids,
      createdAt: Date.now(),
    });
    return { id: ref.id, outingId, description, amount, paidBy: uid, splitAmongUids, createdAt: Date.now() } as Expense;
  },

  subscribeExpenses(outingId, cb) {
    const { db } = requireDb();
    const q = query(collection(db, "expenses"), where("outingId", "==", outingId));
    return onSnapshot(q, (snap) => {
      const expenses = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, "id">) }))
        .sort((a, b) => a.createdAt - b.createdAt);
      cb(expenses);
    });
  },

  async createPoll(outingId, chatId, uid, question, options) {
    const { db } = requireDb();
    const pollOptions = options.map((text) => ({ id: genFirebaseId(), text, votes: [] as string[] }));
    const ref = await addDoc(collection(db, "polls"), {
      outingId,
      chatId,
      question,
      options: pollOptions,
      createdBy: uid,
      createdAt: Date.now(),
    });
    await addDoc(collection(db, "chats", chatId, "messages"), {
      chatId,
      senderId: uid,
      text: `📊 ${question}`,
      createdAt: Date.now(),
      pollId: ref.id,
    });
    await updateDoc(doc(db, "chats", chatId), { lastMessage: `📊 ${question}`, lastMessageAt: Date.now() });
    return { id: ref.id, outingId, chatId, question, options: pollOptions, createdBy: uid, createdAt: Date.now() } as OutingPoll;
  },

  async votePoll(pollId, uid, optionId) {
    const { db } = requireDb();
    const ref = doc(db, "polls", pollId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const poll = snap.data() as OutingPoll;
    const options = poll.options.map((o) => ({
      ...o,
      votes: o.id === optionId ? [...o.votes.filter((v) => v !== uid), uid] : o.votes.filter((v) => v !== uid),
    }));
    await updateDoc(ref, { options });
  },

  subscribePolls(chatId, cb) {
    const { db } = requireDb();
    const q = query(collection(db, "polls"), where("chatId", "==", chatId));
    return onSnapshot(q, (snap) => {
      const polls = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<OutingPoll, "id">) }))
        .sort((a, b) => a.createdAt - b.createdAt);
      cb(polls);
    });
  },

  async triggerSOS(outingId, uid) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    if (!me) throw new Error("User not found.");
    const checkin: SafetyCheckin = {
      id: `${outingId}_${uid}`,
      outingId,
      uid,
      status: "overdue",
      emergencyContactName: me.emergencyContactName,
      emergencyContactPhone: me.emergencyContactPhone,
      sharedAt: Date.now(),
    };
    await setDoc(doc(db, "safetyCheckins", checkin.id), withoutUndefined(checkin));
    await pushNotification(uid, {
      type: "sos_alert",
      title: "SOS sent",
      body: me.emergencyContactName
        ? `We've flagged this to notify ${me.emergencyContactName}. Stay safe - call them directly if you can.`
        : "No emergency contact is set - add one in your profile so SOS can reach someone.",
    });
    return checkin;
  },

  async startLiveLocation(outingId, uid, lat, lng, durationMinutes) {
    const { db } = requireDb();
    const share: LiveLocationShare = {
      id: `${outingId}_${uid}`,
      outingId,
      uid,
      lat,
      lng,
      expiresAt: Date.now() + durationMinutes * 60 * 1000,
      updatedAt: Date.now(),
    };
    await setDoc(doc(db, "liveLocations", share.id), share);
    return share;
  },

  async updateLiveLocation(outingId, uid, lat, lng) {
    const { db } = requireDb();
    const ref = doc(db, "liveLocations", `${outingId}_${uid}`);
    const snap = await getDoc(ref);
    if (!snap.exists() || (snap.data() as LiveLocationShare).expiresAt < Date.now()) return;
    await updateDoc(ref, { lat, lng, updatedAt: Date.now() });
  },

  async stopLiveLocation(outingId, uid) {
    const { db } = requireDb();
    await deleteDoc(doc(db, "liveLocations", `${outingId}_${uid}`)).catch(() => undefined);
  },

  subscribeLiveLocation(outingId, uid, cb) {
    const { db } = requireDb();
    return onSnapshot(doc(db, "liveLocations", `${outingId}_${uid}`), (snap) => {
      if (!snap.exists()) return cb(null);
      const share = snap.data() as LiveLocationShare;
      cb(share.expiresAt > Date.now() ? share : null);
    });
  },

  async getChats(uid) {
    const { db } = requireDb();
    const snap = await getDocs(query(collection(db, "chats"), where("memberIds", "array-contains", uid)));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMeta, "id">) }))
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
  },

  async getChat(id) {
    const { db } = requireDb();
    const snap = await getDoc(doc(db, "chats", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<ChatMeta, "id">) };
  },

  subscribeChats(uid, cb) {
    const { db } = requireDb();
    return onSnapshot(query(collection(db, "chats"), where("memberIds", "array-contains", uid)), (snap) => {
      const chats = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMeta, "id">) }))
        .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
      cb(chats);
    });
  },

  subscribeMessages(chatId, cb) {
    const { db } = requireDb();
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) })));
    });
  },

  async sendMessage(chatId, senderId, text, options) {
    const { db } = requireDb();
    await addDoc(collection(db, "chats", chatId, "messages"), {
      chatId,
      senderId,
      text,
      createdAt: Date.now(),
      imageUrl: options?.imageUrl ?? null,
      audioUrl: options?.audioUrl ?? null,
      stickerId: options?.stickerId ?? null,
      mentions: options?.mentions ?? [],
    });
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    const preview = options?.imageUrl ? "📷 Photo" : options?.audioUrl ? "🎙️ Voice message" : options?.stickerId ? "Sent a sticker" : text;
    await updateDoc(chatRef, { lastMessage: preview, lastMessageAt: Date.now() });
    if (chatSnap.exists()) {
      const chat = chatSnap.data() as ChatMeta;
      const sender = await fetchUser(senderId);
      for (const memberUid of chat.memberIds) {
        if (memberUid === senderId) continue;
        const mentioned = options?.mentions?.includes(memberUid);
        await pushNotification(memberUid, {
          type: "new_message",
          title: mentioned ? `${sender?.name ?? "Someone"} mentioned you` : sender?.name ?? "New message",
          body: preview,
          linkTo: `/chats/${chatId}`,
        });
      }
    }
  },

  async markMessageRead(chatId, messageId, uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "chats", chatId, "messages", messageId), { readBy: arrayUnion(uid) });
  },

  async togglePinMessage(chatId, messageId, uid) {
    const { db } = requireDb();
    const chatSnap = await getDoc(doc(db, "chats", chatId));
    if (!chatSnap.exists() || !(chatSnap.data() as ChatMeta).memberIds.includes(uid)) return;
    const msgRef = doc(db, "chats", chatId, "messages", messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;
    await updateDoc(msgRef, { pinned: !(msgSnap.data() as ChatMessage).pinned });
  },

  async setTyping(chatId, uid, isTyping) {
    const { db } = requireDb();
    const ref = doc(db, "typing", `${chatId}_${uid}`);
    if (isTyping) {
      await setDoc(ref, { chatId, uid, expiresAt: Date.now() + 4000 });
    } else {
      await deleteDoc(ref).catch(() => undefined);
    }
  },

  subscribeTyping(chatId, cb) {
    const { db } = requireDb();
    const q = query(collection(db, "typing"), where("chatId", "==", chatId));
    return onSnapshot(q, (snap) => {
      const now = Date.now();
      const uids = snap.docs
        .map((d) => d.data() as { uid: string; expiresAt: number })
        .filter((t) => t.expiresAt > now)
        .map((t) => t.uid);
      cb(uids);
    });
  },

  async getNotifications(uid) {
    const { db } = requireDb();
    const snap = await getDocs(
      query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }));
  },

  subscribeNotifications(uid, cb) {
    const { db } = requireDb();
    const q = query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) })));
    });
  },

  async markNotificationRead(uid, id) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid, "notifications", id), { read: true });
  },

  async markAllNotificationsRead(uid) {
    const { db } = requireDb();
    const snap = await getDocs(collection(db, "users", uid, "notifications"));
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
  },

  async reportUser(reporterId, reportedId, reason) {
    const { db } = requireDb();
    const ref = await addDoc(collection(db, "reports"), {
      reporterId,
      reportedId,
      reason,
      status: "open",
      createdAt: Date.now(),
    });
    setTimeout(() => {
      void updateDoc(ref, { status: "reviewing" }).catch(() => undefined);
    }, 5000);
  },

  async getMyReports(reporterId) {
    const { db } = requireDb();
    const snap = await getDocs(query(collection(db, "reports"), where("reporterId", "==", reporterId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async blockUser(uid, blockedUid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { blockedUserIds: arrayUnion(blockedUid) });
  },

  async requestVerification(uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { verificationStatus: "pending" });
  },

  async requestIdVerification(uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { idVerificationStatus: "pending" });
  },

  async requestVideoVerification(uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { videoVerificationStatus: "pending" });
  },

  async runPhotoCheck(uid) {
    const { db } = requireDb();
    // Heuristic mock check, NOT a real ML/AI pipeline.
    await updateDoc(doc(db, "users", uid), { photoCheckStatus: "clear" });
  },

  async startSafetyCheckin(outingId, uid) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    if (!me) throw new Error("User not found.");
    const checkinId = `${outingId}_${uid}`;
    const checkin: SafetyCheckin = {
      id: checkinId,
      outingId,
      uid,
      status: "shared",
      emergencyContactName: me.emergencyContactName,
      emergencyContactPhone: me.emergencyContactPhone,
      sharedAt: Date.now(),
    };
    await setDoc(doc(db, "safetyCheckins", checkinId), withoutUndefined(checkin));
    return checkin;
  },

  async confirmSafe(outingId, uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "safetyCheckins", `${outingId}_${uid}`), {
      status: "confirmed_safe",
      confirmedAt: Date.now(),
    });
  },

  async getSafetyCheckin(outingId, uid) {
    const { db } = requireDb();
    const snap = await getDoc(doc(db, "safetyCheckins", `${outingId}_${uid}`));
    if (!snap.exists()) return null;
    const checkin = snap.data() as SafetyCheckin;
    const outingSnap = await getDoc(doc(db, "outings", outingId));
    if (checkin.status === "shared" && outingSnap.exists()) {
      const outing = outingSnap.data() as Outing;
      if (outing.dateTime + 3 * 60 * 60 * 1000 < Date.now()) {
        checkin.status = "overdue";
        await updateDoc(doc(db, "safetyCheckins", `${outingId}_${uid}`), { status: "overdue" });
      }
    }
    return checkin;
  },

  async getOutingAttendees(outingId, uid) {
    const outing = await firebaseProvider.getOuting(outingId);
    if (!outing) return [];
    const profiles = await Promise.all(
      outing.memberIds.filter((id) => id !== uid).map((id) => fetchUser(id))
    );
    return profiles.filter((u): u is UserProfile => Boolean(u));
  },

  async submitReconnectPicks(outingId, uid, pickedUids) {
    const { db } = requireDb();
    const outing = await firebaseProvider.getOuting(outingId);
    if (!outing) return [];

    for (const toUid of pickedUids) {
      await setDoc(doc(db, "reconnectPicks", `${outingId}_${uid}_${toUid}`), {
        id: `${outingId}_${uid}_${toUid}`,
        outingId,
        fromUid: uid,
        toUid,
        createdAt: Date.now(),
      });
    }
    await updateDoc(doc(db, "outings", outingId), { reconnectSubmittedUids: arrayUnion(uid) });

    const newMatches: Match[] = [];
    for (const toUid of pickedUids) {
      const reciprocalSnap = await getDoc(doc(db, "reconnectPicks", `${outingId}_${toUid}_${uid}`));
      if (!reciprocalSnap.exists()) continue;

      const existingMatchSnap = await getDocs(
        query(collection(db, "matches"), where("userIds", "array-contains", uid))
      );
      const alreadyMatched = existingMatchSnap.docs.some((d) =>
        (d.data().userIds as string[]).includes(toUid)
      );
      if (alreadyMatched) continue;

      const me = await fetchUser(uid);
      const other = await fetchUser(toUid);
      if (!me || !other) continue;

      const chatRef = await addDoc(collection(db, "chats"), {
        type: "match",
        memberIds: [uid, toUid],
        title: `${me.name} & ${other.name}`,
        createdAt: Date.now(),
      });
      await addDoc(collection(db, "chats", chatRef.id, "messages"), {
        chatId: chatRef.id,
        senderId: "system",
        text: "You matched! Say hi 👋",
        createdAt: Date.now(),
        system: true,
      });

      const vibeScore = computeVibeScore(me, other);
      const matchRef = await addDoc(collection(db, "matches"), {
        userIds: [uid, toUid],
        chatId: chatRef.id,
        vibeScore,
        createdAt: Date.now(),
      });

      await pushNotification(uid, {
        type: "reconnect_match",
        title: "You both want to stay in touch! 🎉",
        body: `You and ${other.name} matched after "${outing.title}". Say hi!`,
        linkTo: `/chats/${chatRef.id}`,
      });
      await pushNotification(toUid, {
        type: "reconnect_match",
        title: "You both want to stay in touch! 🎉",
        body: `You and ${me.name} matched after "${outing.title}". Say hi!`,
        linkTo: `/chats/${chatRef.id}`,
      });

      newMatches.push({ id: matchRef.id, userIds: [uid, toUid], chatId: chatRef.id, vibeScore, createdAt: Date.now() });
    }
    return newMatches;
  },
};
