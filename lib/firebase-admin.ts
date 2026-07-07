import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set on the server.");
  }
  const serviceAccount = JSON.parse(Buffer.from(key, "base64").toString("utf-8"));
  return initializeApp({ credential: cert(serviceAccount) });
}

export async function verifyFirebaseIdToken(idToken: string) {
  return getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
}
