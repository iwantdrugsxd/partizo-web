"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dataProvider } from "@/lib/data";
import { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = dataProvider.onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refresh = async () => {
    const u = await dataProvider.getCurrentUser();
    setUser(u);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
