// Client-side one-way hash for the privacy-safe blocklist - we never store or transmit
// the raw phone/email, only a hash, so even we can't reconstruct someone's contact info.
export async function hashContact(raw: string): Promise<string> {
  const normalized = raw.trim().toLowerCase().replace(/[\s()-]/g, "");
  const encoded = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
