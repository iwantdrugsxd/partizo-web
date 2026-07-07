import { UserProfile } from "@/lib/types";

export interface TrustBreakdownItem {
  label: string;
  points: number;
  achieved: boolean;
}

export interface TrustScore {
  score: number; // 0-100
  level: "New" | "Building Trust" | "Trusted" | "Highly Trusted";
  breakdown: TrustBreakdownItem[];
}

const PHOTO_VERIFIED_POINTS = 45;
const EMERGENCY_CONTACT_POINTS = 20;
const BIO_COMPLETE_POINTS = 10;
const PROMPTS_COMPLETE_POINTS = 10;
const PER_OUTING_POINTS = 5;
const MAX_OUTING_POINTS = 15;

function levelForScore(score: number): TrustScore["level"] {
  if (score >= 85) return "Highly Trusted";
  if (score >= 55) return "Trusted";
  if (score >= 25) return "Building Trust";
  return "New";
}

/** Graduated trust score derived from verification, safety setup, profile depth, and outing history. */
export function computeTrustScore(user: UserProfile, attendedOutingsCount: number): TrustScore {
  const hasEmergencyContact = Boolean(user.emergencyContactName && user.emergencyContactPhone);
  const hasBio = user.bio.trim().length >= 10;
  const hasPrompts = (user.prompts ?? []).filter((p) => p.answer.trim().length > 0).length >= 2;
  const outingPoints = Math.min(MAX_OUTING_POINTS, attendedOutingsCount * PER_OUTING_POINTS);

  const breakdown: TrustBreakdownItem[] = [
    { label: "Photo verified", points: PHOTO_VERIFIED_POINTS, achieved: user.verificationStatus === "verified" },
    { label: "Emergency contact added", points: EMERGENCY_CONTACT_POINTS, achieved: hasEmergencyContact },
    { label: "Bio filled out", points: BIO_COMPLETE_POINTS, achieved: hasBio },
    { label: "Compatibility prompts answered", points: PROMPTS_COMPLETE_POINTS, achieved: hasPrompts },
    {
      label: attendedOutingsCount > 0 ? `Attended ${attendedOutingsCount} outing(s)` : "Attend an outing",
      points: outingPoints,
      achieved: attendedOutingsCount > 0,
    },
  ];

  const score = breakdown.reduce((sum, item) => sum + (item.achieved ? item.points : 0), 0);
  return { score: Math.min(100, score), level: levelForScore(score), breakdown };
}
