import { isFirebaseConfigured } from "@/lib/firebase";
import { mockProvider } from "@/lib/data/mock-provider";
import { firebaseProvider } from "@/lib/data/firebase-provider";
import { DataProvider } from "@/lib/data/provider";

function resolveProvider(): DataProvider {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE;
  if (mode === "firebase" && isFirebaseConfigured()) {
    return firebaseProvider;
  }
  return mockProvider;
}

export const dataProvider: DataProvider = resolveProvider();
export * from "@/lib/data/provider";
