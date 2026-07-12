"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, differenceInHours } from "date-fns";
import { motion } from "framer-motion";
import Image from "next/image";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import { dataProvider } from "@/lib/data";
import { ChatMessage, ChatMeta, Expense, Outing, OutingPoll, UserProfile } from "@/lib/types";
import { STICKER_PACK, stickerById } from "@/data/stickers";
import PollMessage from "@/components/PollMessage";
import ExpenseSplitPanel from "@/components/ExpenseSplitPanel";
import { IconCheck, IconImage, IconMic, IconPin, IconSmile, IconX } from "@/components/icons";

export default function ChatConversationPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [outing, setOuting] = useState<Outing | null>(null);
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [polls, setPolls] = useState<OutingPoll[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    dataProvider.getChat(id).then(setChat);
    const unsubscribe = dataProvider.subscribeMessages(id, setMessages);
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!chat) return;
    Promise.all(chat.memberIds.map((uid) => dataProvider.getUser(uid))).then((profiles) => {
      setMembers(profiles.filter((p): p is UserProfile => Boolean(p)));
    });
    if (chat.type === "outing" && chat.outingId) {
      dataProvider.getOuting(chat.outingId).then(setOuting);
    }
  }, [chat]);

  useEffect(() => {
    if (!chat || chat.type !== "outing") return;
    const unsubscribe = dataProvider.subscribePolls(id, setPolls);
    return unsubscribe;
  }, [chat, id]);

  useEffect(() => {
    if (!chat || chat.type !== "outing" || !chat.outingId) return;
    const unsubscribe = dataProvider.subscribeExpenses(chat.outingId, setExpenses);
    return unsubscribe;
  }, [chat]);

  useEffect(() => {
    const unsubscribe = dataProvider.subscribeTyping(id, (uids) => {
      setTypingUids(uids.filter((u) => u !== user?.uid));
    });
    return unsubscribe;
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages from others as read, only if I've opted into read receipts.
  useEffect(() => {
    if (!user || !user.readReceiptsEnabled) return;
    const unread = messages.filter((m) => !m.system && m.senderId !== user.uid && !m.readBy?.includes(user.uid));
    unread.forEach((m) => dataProvider.markMessageRead(id, m.id, user.uid));
  }, [messages, user, id]);

  function handleTextChange(value: string) {
    setText(value);
    if (!user) return;
    dataProvider.setTyping(id, user.uid, value.length > 0);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (value.length > 0) {
      typingStopTimer.current = setTimeout(() => dataProvider.setTyping(id, user.uid, false), 3000);
    }
    const atIndex = value.lastIndexOf("@");
    if (chat && chat.memberIds.length > 2 && atIndex !== -1 && (atIndex === 0 || value[atIndex - 1] === " ")) {
      setMentionQuery(value.slice(atIndex + 1));
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(name: string) {
    const atIndex = text.lastIndexOf("@");
    setText(text.slice(0, atIndex) + `@${name} `);
    setMentionQuery(null);
  }

  async function send() {
    if (!text.trim() || !user) return;
    const value = text.trim();
    setText("");
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    dataProvider.setTyping(id, user.uid, false);
    const mentions = members.filter((m) => value.includes(`@${m.name}`)).map((m) => m.uid);
    await dataProvider.sendMessage(id, user.uid, value, mentions.length ? { mentions } : undefined);
  }

  async function sendSticker(stickerId: string) {
    if (!user) return;
    await dataProvider.sendMessage(id, user.uid, "", { stickerId });
    setStickerPickerOpen(false);
  }

  function pickDemoPhoto() {
    if (!user) return;
    const n = Math.floor(Math.random() * 1000);
    dataProvider.sendMessage(id, user.uid, "", { imageUrl: `https://picsum.photos/seed/chat-${n}/500` });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          if (user) await dataProvider.sendMessage(id, user.uid, "", { audioUrl: reader.result as string });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      window.alert("Microphone access isn't available. Voice messages need mic permission.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function createPoll() {
    if (!user || !chat?.outingId || !pollQuestion.trim()) return;
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) return;
    await dataProvider.createPoll(chat.outingId, id, user.uid, pollQuestion.trim(), opts);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollComposerOpen(false);
  }

  async function togglePin(messageId: string) {
    if (!user) return;
    await dataProvider.togglePinMessage(id, messageId, user.uid);
  }

  const otherMemberId =
    chat && chat.type === "match" && user ? chat.memberIds.find((m) => m !== user.uid) : undefined;
  const otherMember = members.find((m) => m.uid === otherMemberId);

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

  const pinnedMessages = messages.filter((m) => m.pinned);
  const galleryImages = messages.filter((m) => m.imageUrl);
  const showMeetupNudge =
    chat?.type === "match" &&
    !outing &&
    messages.length > 0 &&
    differenceInHours(Date.now(), chat.createdAt) >= 48;

  const mentionCandidates = mentionQuery !== null
    ? members.filter((m) => user && m.uid !== user.uid && m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-sm text-white/50">
            ←
          </button>
          {chat?.type === "match" && otherMember?.photos[0] && (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10">
              <Image src={otherMember.photos[0]} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <h1 className="font-display text-base font-bold">{chat?.title ?? "Chat"}</h1>
        </div>
        <div className="flex items-center gap-1">
          {galleryImages.length > 0 && (
            <button onClick={() => setGalleryOpen(true)} className="rounded-full p-2 text-white/50">
              <IconImage className="h-4 w-4" />
            </button>
          )}
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
      </div>

      {pinnedMessages.length > 0 && (
        <div className="border-b border-white/10 bg-white/5 px-4 py-2">
          {pinnedMessages.slice(-1).map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs text-white/60">
              <IconPin className="h-3.5 w-3.5 text-vibe-coral" />
              <span className="truncate">{m.text || "Pinned message"}</span>
            </div>
          ))}
        </div>
      )}

      {showMeetupNudge && otherMember && (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-vibe-gradient/10 px-4 py-2.5">
          <p className="text-xs text-white/70">Been chatting a while - plan a meetup with {otherMember.name}?</p>
          <Link href="/outings" className="shrink-0 rounded-full bg-vibe-gradient px-3 py-1.5 text-xs font-semibold">
            Plan outing
          </Link>
        </div>
      )}

      {chat?.type === "outing" && (
        <div className="flex gap-2 border-b border-white/10 px-4 py-2">
          <button
            onClick={() => setPollComposerOpen(true)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60"
          >
            📊 Poll
          </button>
          <button
            onClick={() => setExpensePanelOpen(true)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60"
          >
            💸 Split bill
          </button>
        </div>
      )}

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
          const poll = m.pollId ? polls.find((p) => p.id === m.pollId) : undefined;
          const sticker = m.stickerId ? stickerById(m.stickerId) : undefined;
          const readByOthers = (m.readBy ?? []).filter((r) => r !== m.senderId);

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={clsx("group flex items-end gap-1", isMe ? "justify-end" : "justify-start")}
            >
              {poll && user ? (
                <PollMessage poll={poll} myUid={user.uid} />
              ) : sticker ? (
                <div className="text-5xl">{sticker.emoji}</div>
              ) : m.imageUrl ? (
                <div className="relative h-48 w-40 overflow-hidden rounded-2xl border border-white/10">
                  <Image src={m.imageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : m.audioUrl ? (
                <audio controls src={m.audioUrl} className="max-w-[75%]" />
              ) : (
                <div
                  className={clsx(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                    isMe ? "bg-vibe-gradient text-white" : "bg-white/10 text-white/90"
                  )}
                >
                  <p>{m.text}</p>
                  <div className={clsx("mt-1 flex items-center gap-1 text-[10px]", isMe ? "text-white/70" : "text-white/30")}>
                    {format(new Date(m.createdAt), "h:mm a")}
                    {isMe && readByOthers.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <IconCheck className="h-2.5 w-2.5" /> Read
                      </span>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={() => togglePin(m.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Pin message"
              >
                <IconPin className={clsx("h-3 w-3", m.pinned ? "text-vibe-coral" : "text-white/30")} />
              </button>
            </motion.div>
          );
        })}
        {typingUids.length > 0 && (
          <p className="text-xs text-white/40">
            {members.find((m) => m.uid === typingUids[0])?.name ?? "Someone"} is typing...
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {mentionCandidates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-vibe-card px-3 py-2">
          {mentionCandidates.map((m) => (
            <button
              key={m.uid}
              onClick={() => pickMention(m.name)}
              className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs"
            >
              @{m.name}
            </button>
          ))}
        </div>
      )}

      {stickerPickerOpen && (
        <div className="grid grid-cols-6 gap-2 border-t border-white/10 bg-vibe-card p-3">
          {STICKER_PACK.map((s) => (
            <button key={s.id} onClick={() => sendSticker(s.id)} className="text-2xl">
              {s.emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button onClick={pickDemoPhoto} aria-label="Send photo" className="shrink-0 text-white/50">
          <IconImage className="h-5 w-5" />
        </button>
        <button
          onClick={() => setStickerPickerOpen((v) => !v)}
          aria-label="Send sticker"
          className="shrink-0 text-white/50"
        >
          <IconSmile className="h-5 w-5" />
        </button>
        <input
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-vibe-coral"
        />
        {text.trim() ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={send}
            className="shrink-0 rounded-full bg-vibe-gradient px-5 py-2.5 text-sm font-semibold shadow-glow"
          >
            Send
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            aria-label="Hold to record voice message"
            className={clsx(
              "shrink-0 rounded-full p-3 shadow-glow",
              recording ? "bg-red-500" : "bg-vibe-gradient"
            )}
          >
            <IconMic className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {pollComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={() => setPollComposerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-vibe-card p-5 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">New poll</h2>
              <button onClick={() => setPollComposerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="What's the question?"
              className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral"
            />
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => setPollOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))}
                placeholder={`Option ${i + 1}`}
                className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-vibe-coral"
              />
            ))}
            {pollOptions.length < 4 && (
              <button
                onClick={() => setPollOptions((o) => [...o, ""])}
                className="mb-3 text-xs font-semibold text-vibe-coral"
              >
                + Add option
              </button>
            )}
            <button
              onClick={createPoll}
              className="w-full rounded-lg bg-vibe-gradient py-2.5 text-sm font-semibold disabled:opacity-40"
              disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
            >
              Create poll
            </button>
          </div>
        </div>
      )}

      {expensePanelOpen && chat?.outingId && user && (
        <ExpenseSplitPanel
          outingId={chat.outingId}
          myUid={user.uid}
          members={members}
          expenses={expenses}
          onClose={() => setExpensePanelOpen(false)}
        />
      )}

      {galleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setGalleryOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-vibe-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold">Shared media</h2>
              <button onClick={() => setGalleryOpen(false)}>
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {galleryImages.map((m) => (
                <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl">
                  <Image src={m.imageUrl!} alt="" fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
