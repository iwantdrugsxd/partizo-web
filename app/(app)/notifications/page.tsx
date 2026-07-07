"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { AppNotification, NotificationType } from "@/lib/types";

const ICON: Record<NotificationType, string> = {
  new_match: "✨",
  outing_request_received: "🙋",
  outing_request_accepted: "🎉",
  outing_request_rejected: "😔",
  new_message: "💬",
  safety_checkin: "🛡️",
  outing_reminder: "⏰",
  reconnect_match: "🔁",
  outing_cancelled: "🚫",
  outing_rating_prompt: "⭐",
  sos_alert: "🆘",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = dataProvider.subscribeNotifications(user.uid, setItems);
    return unsubscribe;
  }, [user]);

  async function handleClick(n: AppNotification) {
    if (!user) return;
    await dataProvider.markNotificationRead(user.uid, n.id);
    if (n.linkTo) router.push(n.linkTo);
  }

  async function markAll() {
    if (!user) return;
    await dataProvider.markAllNotificationsRead(user.uid);
  }

  return (
    <div className="px-5 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-gradient">Notifications</h1>
        {items && items.some((n) => !n.read) && (
          <button onClick={markAll} className="text-xs font-medium text-white/50">
            Mark all read
          </button>
        )}
      </div>

      {items === null ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-white/40">
          Nothing yet. Swipe, match, or plan an outing to get things moving.
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={clsx(
                "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5",
                !n.read && "bg-white/5"
              )}
            >
              <span className="text-xl">{ICON[n.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="truncate text-xs text-white/50">{n.body}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-white/30">{formatDistanceToNowStrict(n.createdAt)}</span>
                {!n.read && <span className="h-2 w-2 rounded-full bg-vibe-coral" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
