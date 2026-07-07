import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
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
import { auth, db } from "@/lib/firebase";
import {
  AppNotification,
  ChatMessage,
  ChatMeta,
  Match,
  Outing,
  UserProfile,
} from "@/lib/types";
import { computeTraitsFromAnswers, computeVibeScore, personalityLabel, sharedTags } from "@/lib/vibe";
import {
  CreateOutingInput,
  DataProvider,
  DeckCandidate,
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

  async completeOnboarding(uid, data: OnboardingData) {
    const { db } = requireDb();
    const traits = computeTraitsFromAnswers(data.quizAnswers);
    await updateDoc(doc(db, "users", uid), {
      ...data,
      traits,
      personalityLabel: personalityLabel(traits),
      onboardingComplete: true,
    } as DocumentData);
  },

  async getDeck(uid) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    if (!me) return [];

    const swipesSnap = await getDocs(
      query(collection(db, "swipes"), where("fromUid", "==", uid))
    );
    const swipedIds = new Set(swipesSnap.docs.map((d) => d.data().toUid as string));

    const usersSnap = await getDocs(collection(db, "users"));
    const candidates: DeckCandidate[] = [];
    usersSnap.forEach((d) => {
      if (d.id === uid) return;
      if (swipedIds.has(d.id)) return;
      const u = docToUser(d.data(), d.id);
      if (!u.onboardingComplete) return;
      if (me.blockedUserIds.includes(u.uid) || u.blockedUserIds?.includes(uid)) return;
      if (me.showMePreference !== "everyone" && u.gender !== me.showMePreference) return;
      candidates.push({ ...u, vibeScore: computeVibeScore(me, u), sharedTags: sharedTags(me.tags, u.tags) });
    });
    candidates.sort((a, b) => b.vibeScore - a.vibeScore);
    return candidates;
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
    const ref = await addDoc(collection(db, "outings"), {
      ...input,
      status: "live",
      requests: [],
      memberIds: [input.leaderId],
      chatId: null,
      createdAt: Date.now(),
    });
    return { id: ref.id, ...input, status: "live", requests: [], memberIds: [input.leaderId], chatId: null, createdAt: Date.now() } as Outing;
  },

  async getLiveOutings(uid) {
    const { db } = requireDb();
    const me = await fetchUser(uid);
    const snap = await getDocs(
      query(collection(db, "outings"), where("status", "in", ["live", "full"]))
    );
    const outings = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Outing, "id">) }))
      .filter((o) => o.leaderId !== uid);
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
      map.set(d.id, { id: d.id, ...(d.data() as Omit<Outing, "id">) });
    });
    return Array.from(map.values());
  },

  async getOuting(id) {
    const { db } = requireDb();
    const snap = await getDoc(doc(db, "outings", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Outing, "id">) };
  },

  subscribeOuting(id, cb) {
    const { db } = requireDb();
    return onSnapshot(doc(db, "outings", id), (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Outing, "id">) }) : null);
    });
  },

  async requestToJoin(outingId, uid) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = snap.data() as Outing;
    if (outing.requests.some((r) => r.uid === uid) || outing.memberIds.includes(uid)) return;
    await updateDoc(outingRef, {
      requests: arrayUnion({ uid, status: "pending", requestedAt: Date.now() }),
    });
    const requester = await fetchUser(uid);
    await pushNotification(outing.leaderId, {
      type: "outing_request_received",
      title: "New outing request",
      body: `${requester?.name ?? "Someone"} wants to join "${outing.title}"`,
      linkTo: `/outings/${outingId}`,
    });
  },

  async respondToRequest(outingId, targetUid, accept) {
    const { db } = requireDb();
    const outingRef = doc(db, "outings", outingId);
    const snap = await getDoc(outingRef);
    if (!snap.exists()) return;
    const outing = { id: snap.id, ...(snap.data() as Omit<Outing, "id">) } as Outing;
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

    const status = memberIds.length >= outing.capacity ? "full" : outing.status;

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

  async sendMessage(chatId, senderId, text) {
    const { db } = requireDb();
    await addDoc(collection(db, "chats", chatId, "messages"), {
      chatId,
      senderId,
      text,
      createdAt: Date.now(),
    });
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    await updateDoc(chatRef, { lastMessage: text, lastMessageAt: Date.now() });
    if (chatSnap.exists()) {
      const chat = chatSnap.data() as ChatMeta;
      const sender = await fetchUser(senderId);
      for (const memberUid of chat.memberIds) {
        if (memberUid === senderId) continue;
        await pushNotification(memberUid, {
          type: "new_message",
          title: sender?.name ?? "New message",
          body: text,
          linkTo: `/chats/${chatId}`,
        });
      }
    }
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
    await addDoc(collection(db, "reports"), { reporterId, reportedId, reason, createdAt: Date.now() });
  },

  async blockUser(uid, blockedUid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { blockedUserIds: arrayUnion(blockedUid) });
  },

  async requestVerification(uid) {
    const { db } = requireDb();
    await updateDoc(doc(db, "users", uid), { verificationStatus: "pending" });
  },
};
