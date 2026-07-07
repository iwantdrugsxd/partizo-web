"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import BottomNav from "@/components/BottomNav";
import FabCreateOuting from "@/components/FabCreateOuting";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const hideFab = /^\/chats\/.+/.test(pathname ?? "");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = dataProvider.subscribeNotifications(user.uid, (items) => {
      setUnreadCount(items.filter((n) => !n.read).length);
    });
    return unsubscribe;
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto pb-20">{children}</div>
      {!hideFab && <FabCreateOuting />}
      <BottomNav unreadCount={unreadCount} />
    </div>
  );
}
