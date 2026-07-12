"use client";

import { useState } from "react";
import { Expense, UserProfile } from "@/lib/types";
import { dataProvider } from "@/lib/data";
import { IconX } from "@/components/icons";

interface Props {
  outingId: string;
  myUid: string;
  members: UserProfile[];
  expenses: Expense[];
  onClose: () => void;
}

export default function ExpenseSplitPanel({ outingId, myUid, members, expenses, onClose }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitAmong, setSplitAmong] = useState<string[]>(members.map((m) => m.uid));

  function toggleSplit(uid: string) {
    setSplitAmong((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid]));
  }

  async function addExpense() {
    const amt = Number(amount);
    if (!description.trim() || !amt || amt <= 0 || splitAmong.length === 0) return;
    await dataProvider.addExpense(outingId, myUid, description.trim(), amt, splitAmong);
    setDescription("");
    setAmount("");
  }

  const totalPaidByMe = expenses.filter((e) => e.paidBy === myUid).reduce((s, e) => s + e.amount, 0);
  const myShare = expenses.reduce((sum, e) => {
    if (!e.splitAmongUids.includes(myUid)) return sum;
    return sum + e.amount / e.splitAmongUids.length;
  }, 0);
  const netBalance = totalPaidByMe - myShare;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-vibe-card p-5 sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Split the bill</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xs text-white/50">Your balance</p>
          <p className={`font-display text-2xl font-extrabold ${netBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {netBalance >= 0 ? "+" : ""}
            ₹{netBalance.toFixed(0)}
          </p>
          <p className="text-[11px] text-white/40">{netBalance >= 0 ? "You're owed this much" : "You owe this much"}</p>
        </div>

        {expenses.length === 0 ? (
          <p className="mb-4 text-center text-xs text-white/40">No expenses yet - add the first one below.</p>
        ) : (
          <div className="mb-4 space-y-2">
            {expenses.map((e) => {
              const payer = members.find((m) => m.uid === e.paidBy);
              return (
                <div key={e.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-white/40">
                      {payer?.name ?? "Someone"} paid · split {e.splitAmongUids.length} ways
                    </p>
                  </div>
                  <p className="font-semibold">₹{e.amount}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-medium text-white/50">Add an expense</p>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it for?"
            className="w-full rounded-lg border border-white/10 bg-vibe-card px-3 py-2 text-sm outline-none focus:border-vibe-coral"
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="w-full rounded-lg border border-white/10 bg-vibe-card px-3 py-2 text-sm outline-none focus:border-vibe-coral"
          />
          <div>
            <p className="mb-1.5 text-[11px] text-white/40">Split among</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => toggleSplit(m.uid)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    splitAmong.includes(m.uid) ? "border-transparent bg-vibe-gradient" : "border-white/15 text-white/60"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={addExpense}
            className="w-full rounded-lg bg-vibe-gradient py-2 text-sm font-semibold disabled:opacity-40"
            disabled={!description.trim() || !amount || splitAmong.length === 0}
          >
            Add expense
          </button>
        </div>
      </div>
    </div>
  );
}
