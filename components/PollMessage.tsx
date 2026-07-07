"use client";

import { OutingPoll } from "@/lib/types";
import { dataProvider } from "@/lib/data";

interface Props {
  poll: OutingPoll;
  myUid: string;
}

export default function PollMessage({ poll, myUid }: Props) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);

  return (
    <div className="w-full max-w-[85%] rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="mb-2 text-sm font-semibold">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
          const mine = opt.votes.includes(myUid);
          return (
            <button
              key={opt.id}
              onClick={() => dataProvider.votePoll(poll.id, myUid, opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs ${
                mine ? "border-vibe-coral" : "border-white/10"
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-vibe-gradient/30"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span>{opt.text}</span>
                <span className="text-white/50">
                  {opt.votes.length} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
