import {
  AppNotification,
  ChatMessage,
  ChatMeta,
  Match,
  Outing,
  QuizAnswer,
  SwipeDirection,
  UserProfile,
} from "@/lib/types";

export interface OnboardingData {
  name: string;
  age: number;
  gender: UserProfile["gender"];
  showMePreference: UserProfile["showMePreference"];
  city: string;
  bio: string;
  photos: string[];
  tags: string[];
  quizAnswers: QuizAnswer[];
}

export interface CreateOutingInput {
  leaderId: string;
  title: string;
  category: string;
  description: string;
  location: string;
  dateTime: number;
  capacity: number;
  minVibeScore: number;
  vibeTags: string[];
}

export interface SwipeResult {
  matched: boolean;
  match?: Match;
}

export interface DeckCandidate extends UserProfile {
  vibeScore: number;
  sharedTags: string[];
}

/**
 * A single interface implemented by both the mock (localStorage) backend and
 * the Firebase backend, so every page/component is backend-agnostic.
 */
export interface DataProvider {
  // --- Auth ---
  signUp(email: string, password: string, name: string): Promise<UserProfile>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signOutUser(): Promise<void>;
  getCurrentUser(): Promise<UserProfile | null>;
  onAuthChange(cb: (user: UserProfile | null) => void): () => void;

  // --- Users / profile ---
  getUser(uid: string): Promise<UserProfile | null>;
  updateProfile(uid: string, partial: Partial<UserProfile>): Promise<void>;
  completeOnboarding(uid: string, data: OnboardingData): Promise<void>;

  // --- Connect / swipe ---
  getDeck(uid: string): Promise<DeckCandidate[]>;
  recordSwipe(fromUid: string, toUid: string, direction: SwipeDirection): Promise<SwipeResult>;
  getMatches(uid: string): Promise<Match[]>;

  // --- Outings ---
  createOuting(input: CreateOutingInput): Promise<Outing>;
  getLiveOutings(uid: string): Promise<Outing[]>;
  getMyOutings(uid: string): Promise<Outing[]>;
  getOuting(id: string): Promise<Outing | null>;
  subscribeOuting(id: string, cb: (outing: Outing | null) => void): () => void;
  requestToJoin(outingId: string, uid: string): Promise<void>;
  respondToRequest(outingId: string, targetUid: string, accept: boolean): Promise<void>;

  // --- Chats ---
  getChats(uid: string): Promise<ChatMeta[]>;
  getChat(id: string): Promise<ChatMeta | null>;
  subscribeChats(uid: string, cb: (chats: ChatMeta[]) => void): () => void;
  subscribeMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void;
  sendMessage(chatId: string, senderId: string, text: string): Promise<void>;

  // --- Notifications ---
  getNotifications(uid: string): Promise<AppNotification[]>;
  subscribeNotifications(uid: string, cb: (items: AppNotification[]) => void): () => void;
  markNotificationRead(uid: string, id: string): Promise<void>;
  markAllNotificationsRead(uid: string): Promise<void>;

  // --- Safety ---
  reportUser(reporterId: string, reportedId: string, reason: string): Promise<void>;
  blockUser(uid: string, blockedUid: string): Promise<void>;
  requestVerification(uid: string): Promise<void>;
}
