"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.onboardingComplete) {
      router.replace("/onboarding");
    } else {
      router.replace("/connect");
    }
  }, [user, loading, router]);

  return (
    <div className="relative flex h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <AnimatedBackground />
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="font-display text-5xl font-extrabold text-gradient"
      >
        Partizo
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-3 text-sm text-white/60"
      >
        Finding your vibe...
      </motion.p>
    </div>
  );
}
