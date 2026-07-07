"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import BottomNav from "@/components/BottomNav";
import FabCreateOuting from "@/components/FabCreateOuting";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const inChatRoom = /^\/chats\/.+/.test(pathname ?? "");
  const hideFab = inChatRoom;
  const hideBottomNav = inChatRoom;

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
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col">
      <div
        className={clsx("no-scrollbar flex-1 overflow-y-auto", !hideBottomNav && "pb-[calc(5rem+env(safe-area-inset-bottom))]")}
      >
        {children}
      </div>
      {!hideFab && <FabCreateOuting />}
      {!hideBottomNav && <BottomNav unreadCount={unreadCount} />}
    </div>
  );
}
