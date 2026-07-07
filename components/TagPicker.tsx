"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { VIBE_TAGS, MAX_TAGS } from "@/data/tags";

interface Props {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export default function TagPicker({ selected, onChange }: Props) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (selected.length < MAX_TAGS) {
      onChange([...selected, tag]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {VIBE_TAGS.map((tag) => {
        const active = selected.includes(tag);
        return (
          <motion.button
            key={tag}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => toggle(tag)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-transparent bg-vibe-gradient text-white shadow-glow"
                : "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
            )}
          >
            {tag}
          </motion.button>
        );
      })}
    </div>
  );
}
