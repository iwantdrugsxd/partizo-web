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

export interface UserProfile {
  uid: string;
  name: string;
  age: number;
  gender: "male" | "female" | "non-binary" | "other";
  showMePreference: "everyone" | "male" | "female" | "non-binary";
  city: string;
  bio: string;
  photos: string[]; // URLs, first is primary
  tags: string[]; // interest/vibe tags
  traits: TraitVector; // derived from quiz
  quizAnswers: QuizAnswer[];
  personalityLabel: string; // e.g. "Adventurous Extrovert"
  verified: boolean;
  verificationStatus: "none" | "pending" | "verified";
  lowDataMode: boolean;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  blockedUserIds: string[];
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

export type OutingStatus = "live" | "full" | "closed" | "completed";

export interface OutingRequest {
  uid: string;
  status: "pending" | "accepted" | "rejected";
  requestedAt: number;
}

export interface Outing {
  id: string;
  leaderId: string;
  title: string;
  category: string;
  description: string;
  location: string;
  dateTime: number; // epoch ms
  capacity: number;
  minVibeScore: number; // requesters below this can still request, just ranked lower
  vibeTags: string[];
  status: OutingStatus;
  requests: OutingRequest[];
  memberIds: string[]; // accepted members incl leader
  chatId: string | null;
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
}

export type NotificationType =
  | "new_match"
  | "outing_request_received"
  | "outing_request_accepted"
  | "outing_request_rejected"
  | "new_message"
  | "safety_checkin";

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
  createdAt: number;
}
