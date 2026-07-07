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
  OutingVisibility,
  ProfilePrompt,
  QuizAnswer,
  Report,
  SafetyCheckin,
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
  prompts: ProfilePrompt[];
  quizAnswers: QuizAnswer[];
}

export interface CreateOutingInput {
  leaderId: string;
  title: string;
  category: string;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  dateTime: number;
  capacity: number;
  minVibeScore: number;
  vibeTags: string[];
  visibility: OutingVisibility;
  invitedUserIds: string[];
  recurrence?: { freq: "weekly"; count: number };
}

export interface SwipeResult {
  matched: boolean;
  match?: Match;
}

export interface DeckCandidate extends UserProfile {
  vibeScore: number;
  sharedTags: string[];
  distanceKm?: number;
}

export interface DeckFilters {
  minVibeScore?: number;
  minAge?: number;
  maxAge?: number;
  requiredTags?: string[];
  maxDistanceKm?: number;
}

export interface OutingSearchFilters {
  query?: string;
  category?: string;
  fromDate?: number;
  toDate?: number;
}

export interface SendMessageOptions {
  imageUrl?: string;
  audioUrl?: string;
  stickerId?: string;
  mentions?: string[];
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
  getDeck(uid: string, filters?: DeckFilters): Promise<DeckCandidate[]>;
  recordSwipe(fromUid: string, toUid: string, direction: SwipeDirection): Promise<SwipeResult>;
  undoLastSwipe(uid: string): Promise<DeckCandidate | null>;
  getLikedByUsers(uid: string): Promise<DeckCandidate[]>;
  getMatches(uid: string): Promise<Match[]>;

  // --- Outings ---
  createOuting(input: CreateOutingInput): Promise<Outing>;
  getLiveOutings(uid: string, filters?: OutingSearchFilters): Promise<Outing[]>;
  getMyOutings(uid: string): Promise<Outing[]>;
  getOuting(id: string): Promise<Outing | null>;
  subscribeOuting(id: string, cb: (outing: Outing | null) => void): () => void;
  requestToJoin(outingId: string, uid: string, guestCount?: number): Promise<void>;
  respondToRequest(outingId: string, targetUid: string, accept: boolean): Promise<void>;
  leaveOuting(outingId: string, uid: string): Promise<void>;
  checkOutingReminders(uid: string): Promise<void>;
  cancelOuting(outingId: string, uid: string, reason?: string): Promise<void>;
  rescheduleOuting(outingId: string, uid: string, newDateTime: number): Promise<void>;
  setCoHost(outingId: string, uid: string, coHostUid: string | null): Promise<void>;
  addOutingPhoto(outingId: string, uid: string, photoUrl: string): Promise<void>;
  submitOutingRating(
    outingId: string,
    uid: string,
    rating: { venueRating: number; vibeRating: number; comment?: string }
  ): Promise<void>;
  getOutingRatings(outingId: string): Promise<OutingRating[]>;
  getLeaderReputation(uid: string): Promise<{ avgVenueRating: number; avgVibeRating: number; ratingCount: number }>;

  // --- Outing expenses (split the bill) ---
  addExpense(outingId: string, uid: string, description: string, amount: number, splitAmongUids: string[]): Promise<Expense>;
  subscribeExpenses(outingId: string, cb: (expenses: Expense[]) => void): () => void;

  // --- Outing polls ---
  createPoll(outingId: string, chatId: string, uid: string, question: string, options: string[]): Promise<OutingPoll>;
  votePoll(pollId: string, uid: string, optionId: string): Promise<void>;
  subscribePolls(chatId: string, cb: (polls: OutingPoll[]) => void): () => void;

  // --- Safety check-ins ---
  startSafetyCheckin(outingId: string, uid: string): Promise<SafetyCheckin>;
  confirmSafe(outingId: string, uid: string): Promise<void>;
  getSafetyCheckin(outingId: string, uid: string): Promise<SafetyCheckin | null>;
  triggerSOS(outingId: string, uid: string): Promise<SafetyCheckin>;

  // --- Live location sharing ---
  startLiveLocation(outingId: string, uid: string, lat: number, lng: number, durationMinutes: number): Promise<LiveLocationShare>;
  updateLiveLocation(outingId: string, uid: string, lat: number, lng: number): Promise<void>;
  stopLiveLocation(outingId: string, uid: string): Promise<void>;
  subscribeLiveLocation(outingId: string, uid: string, cb: (share: LiveLocationShare | null) => void): () => void;

  // --- Post-outing reconnect ---
  getOutingAttendees(outingId: string, uid: string): Promise<UserProfile[]>;
  submitReconnectPicks(outingId: string, uid: string, pickedUids: string[]): Promise<Match[]>;

  // --- Chats ---
  getChats(uid: string): Promise<ChatMeta[]>;
  getChat(id: string): Promise<ChatMeta | null>;
  subscribeChats(uid: string, cb: (chats: ChatMeta[]) => void): () => void;
  subscribeMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void;
  sendMessage(chatId: string, senderId: string, text: string, options?: SendMessageOptions): Promise<void>;
  markMessageRead(chatId: string, messageId: string, uid: string): Promise<void>;
  togglePinMessage(chatId: string, messageId: string, uid: string): Promise<void>;
  setTyping(chatId: string, uid: string, isTyping: boolean): Promise<void>;
  subscribeTyping(chatId: string, cb: (typingUids: string[]) => void): () => void;

  // --- Notifications ---
  getNotifications(uid: string): Promise<AppNotification[]>;
  subscribeNotifications(uid: string, cb: (items: AppNotification[]) => void): () => void;
  markNotificationRead(uid: string, id: string): Promise<void>;
  markAllNotificationsRead(uid: string): Promise<void>;

  // --- Safety ---
  reportUser(reporterId: string, reportedId: string, reason: string): Promise<void>;
  getMyReports(uid: string): Promise<Report[]>;
  blockUser(uid: string, blockedUid: string): Promise<void>;
  requestVerification(uid: string): Promise<void>;
  requestIdVerification(uid: string): Promise<void>;
  requestVideoVerification(uid: string): Promise<void>;
  runPhotoCheck(uid: string): Promise<void>;
}
