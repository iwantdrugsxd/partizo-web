"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { IconPlus } from "@/components/icons";
import CreateOutingModal from "@/components/CreateOutingModal";

export default function FabCreateOuting() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.06 }}
        animate={{ boxShadow: ["0 0 0px rgba(255,92,122,0.5)", "0 0 24px rgba(255,92,122,0.6)", "0 0 0px rgba(255,92,122,0.5)"] }}
        transition={{ boxShadow: { duration: 2.5, repeat: Infinity } }}
        className="absolute bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-vibe-gradient text-white"
        aria-label="Create outing"
      >
        <IconPlus className="h-6 w-6" />
      </motion.button>
      <CreateOutingModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
