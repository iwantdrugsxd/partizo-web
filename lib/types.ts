export type TraitKey =
  | "extraversion"
  | "adventure"
  | "humor"
  | "depth"
  | "spontaneity";

export type TraitVector = Record<TraitKey, number>; // each 0-10

export interface QuizAnswer {
  questionId: string;
  choiceIndex: number;
}

export interface ProfilePrompt {
  promptId: string;
  answer: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  age: number;
  gender: "male" | "female" | "non-binary" | "other";
  showMePreference: "everyone" | "male" | "female" | "non-binary";
  city: string;
  lat?: number;
  lng?: number;
  bio: string;
  photos: string[]; // URLs, first is primary
  tags: string[]; // interest/vibe tags
  prompts: ProfilePrompt[]; // up to 3 structured compatibility prompts
  traits: TraitVector; // derived from quiz
  quizAnswers: QuizAnswer[];
  personalityLabel: string; // e.g. "Adventurous Extrovert"
  verified: boolean;
  verificationStatus: "none" | "pending" | "verified";
  idVerificationStatus: "none" | "pending" | "verified";
  videoVerificationStatus: "none" | "pending" | "verified";
  photoCheckStatus?: "clear" | "flagged"; // heuristic mock check, not real ML
  lowDataMode: boolean;
  readReceiptsEnabled: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  blockedUserIds: string[];
  blockedContactHashes: string[]; // manually-entered numbers/emails, hashed client-side
  onboardingComplete: boolean;
  createdAt: number;
}

export type SwipeDirection = "like" | "pass";

export interface SwipeRecord {
  id: string; // `${fromUid}_${toUid}`
  fromUid: string;
  toUid: string;
  direction: SwipeDirection;
  createdAt: number;
}

export interface Match {
  id: string;
  userIds: [string, string];
  chatId: string;
  vibeScore: number;
  createdAt: number;
}

export type OutingStatus = "live" | "full" | "closed" | "completed" | "cancelled";

export interface OutingRequest {
  uid: string;
  status: "pending" | "accepted" | "rejected" | "waitlisted";
  requestedAt: number;
  guestCount?: number; // plus-ones brought by this accepted member, counts against capacity
}

export type OutingVisibility = "public" | "private";

export interface RecurrenceRule {
  freq: "weekly";
  count: number; // total instances generated, including the first
  seriesId: string; // shared across all instances in the series
}

export interface Outing {
  id: string;
  leaderId: string;
  coHostId?: string;
  title: string;
  category: string;
  description: string;
  location: string;
  lat?: number;
  lng?: number;
  dateTime: number; // epoch ms
  capacity: number;
  minVibeScore: number; // requesters below this can still request, just ranked lower
  vibeTags: string[];
  visibility: OutingVisibility;
  invitedUserIds: string[]; // only relevant when visibility === "private"
  status: OutingStatus;
  cancelReason?: string;
  requests: OutingRequest[];
  memberIds: string[]; // accepted members incl leader
  chatId: string | null;
  reminderSent: boolean;
  reconnectSubmittedUids: string[]; // members who've submitted their post-outing "vibe check" picks
  photoAlbum: string[];
  recurrence?: RecurrenceRule;
  createdAt: number;
}

export interface OutingPollOption {
  id: string;
  text: string;
  votes: string[]; // uids
}

export interface OutingPoll {
  id: string;
  outingId: string;
  chatId: string;
  question: string;
  options: OutingPollOption[];
  createdBy: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  outingId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitAmongUids: string[];
  createdAt: number;
}

export interface OutingRating {
  id: string;
  outingId: string;
  uid: string;
  venueRating: number; // 1-5
  vibeRating: number; // 1-5
  comment?: string;
  createdAt: number;
}

export interface SafetyCheckin {
  id: string;
  outingId: string;
  uid: string;
  status: "shared" | "confirmed_safe" | "overdue";
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  sharedAt: number;
  confirmedAt?: number;
}

export interface ReconnectPick {
  id: string;
  outingId: string;
  fromUid: string;
  toUid: string;
  createdAt: number;
}

export type ChatType = "match" | "outing";

export interface ChatMeta {
  id: string;
  type: ChatType;
  memberIds: string[];
  outingId?: string;
  title: string;
  lastMessage?: string;
  lastMessageAt?: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: number;
  system?: boolean;
  imageUrl?: string;
  audioUrl?: string;
  stickerId?: string;
  pollId?: string;
  mentions?: string[]; // uids mentioned via @name
  pinned?: boolean;
  readBy?: string[]; // uids who've read this message (only populated if reader has read receipts on)
}

export type NotificationType =
  | "new_match"
  | "outing_request_received"
  | "outing_request_accepted"
  | "outing_request_rejected"
  | "new_message"
  | "safety_checkin"
  | "outing_reminder"
  | "reconnect_match"
  | "outing_cancelled"
  | "outing_rating_prompt"
  | "sos_alert";

export interface AppNotification {
  id: string;
  uid: string; // recipient
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  linkTo?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  status: "open" | "reviewing" | "resolved";
  createdAt: number;
  resolvedAt?: number;
}

export interface LiveLocationShare {
  id: string;
  outingId: string;
  uid: string;
  lat: number;
  lng: number;
  expiresAt: number;
  updatedAt: number;
}
