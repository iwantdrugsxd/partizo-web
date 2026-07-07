"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { ChatMessage, ChatMeta } from "@/lib/types";

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dataProvider.getChat(id).then(setChat);
    const unsubscribe = dataProvider.subscribeMessages(id, setMessages);
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!text.trim() || !user) return;
    const value = text.trim();
    setText("");
    await dataProvider.sendMessage(id, user.uid, value);
  }

  const otherMemberId =
    chat && chat.type === "match" && user ? chat.memberIds.find((m) => m !== user.uid) : undefined;

  async function handleReport() {
    if (!user || !otherMemberId) return;
    const reason = window.prompt("What's going on? (reason for report)") ?? "";
    if (reason) await dataProvider.reportUser(user.uid, otherMemberId, reason);
    setMenuOpen(false);
  }

  async function handleBlock() {
    if (!user || !otherMemberId) return;
    await dataProvider.blockUser(user.uid, otherMemberId);
    setMenuOpen(false);
    router.push("/chats");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-sm text-white/50">
            ←
          </button>
          <h1 className="font-display text-base font-bold">{chat?.title ?? "Chat"}</h1>
        </div>
        {chat?.type === "match" && user && (
          <div>
            <button onClick={() => setMenuOpen((v) => !v)} className="px-2 text-lg text-white/50">
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-4 top-14 z-10 w-40 overflow-hidden rounded-xl border border-white/10 bg-vibe-card shadow-card">
                <button
                  onClick={handleReport}
                  className="block w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/5"
                >
                  Report
                </button>
                <button
                  onClick={handleBlock}
                  className="block w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/5"
                >
                  Block
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const isMe = m.senderId === user?.uid;
          if (m.system) {
            return (
              <p key={m.id} className="text-center text-xs text-white/30">
                {m.text}
              </p>
            );
          }
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx("flex", isMe ? "justify-end" : "justify-start")}
            >
              <div
                className={clsx(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                  isMe ? "bg-vibe-gradient text-white" : "bg-white/10 text-white/90"
                )}
              >
                <p>{m.text}</p>
                <p className={clsx("mt-1 text-[10px]", isMe ? "text-white/70" : "text-white/30")}>
                  {format(new Date(m.createdAt), "h:mm a")}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-vibe-coral"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={send}
          className="rounded-full bg-vibe-gradient px-5 py-2.5 text-sm font-semibold shadow-glow"
        >
          Send
        </motion.button>
      </div>
    </div>
  );
}
