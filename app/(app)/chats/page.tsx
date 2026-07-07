"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNowStrict } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { ChatMeta, UserProfile } from "@/lib/types";
import { IconChat } from "@/components/icons";

export default function ChatsPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatMeta[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  useEffect(() => {
    if (!user) return;
    const unsubscribe = dataProvider.subscribeChats(user.uid, setChats);
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!chats || !user) return;
    const otherIds = new Set<string>();
    chats.forEach((c) => {
      if (c.type === "match") {
        c.memberIds.filter((m) => m !== user.uid).forEach((m) => otherIds.add(m));
      }
    });
    Promise.all(Array.from(otherIds).map((id) => dataProvider.getUser(id))).then((list) => {
      const map: Record<string, UserProfile> = {};
      list.forEach((p) => p && (map[p.uid] = p));
      setProfiles(map);
    });
  }, [chats, user]);

  return (
    <div className="px-5 pt-6">
      <h1 className="mb-5 font-display text-2xl font-extrabold text-gradient">Chats</h1>

      {chats === null ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
        </div>
      ) : chats.length === 0 ? (
        <div className="py-16 text-center text-sm text-white/40">
          No conversations yet. Match with someone or join an outing to start chatting.
        </div>
      ) : (
        <div className="space-y-1">
          {chats.map((chat) => {
            const otherId = user ? chat.memberIds.find((m) => m !== user.uid) : undefined;
            const otherProfile = chat.type === "match" && otherId ? profiles[otherId] : undefined;
            return (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}`}
                className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-white/5"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {otherProfile?.photos[0] ? (
                    <Image src={otherProfile.photos[0]} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <IconChat className="h-5 w-5 text-white/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold">{chat.title}</p>
                    {chat.lastMessageAt && (
                      <span className="shrink-0 text-[10px] text-white/30">
                        {formatDistanceToNowStrict(chat.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-white/50">
                    {chat.lastMessage ?? (chat.type === "outing" ? "Outing crew chat" : "Say hi!")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
