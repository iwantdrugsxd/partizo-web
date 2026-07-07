"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { dataProvider } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await dataProvider.signUp(email, password, name);
      await refresh();
      router.replace("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-center px-6 py-12">
      <AnimatedBackground />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center"
      >
        <h1 className="font-display text-4xl font-extrabold text-gradient">Partizo</h1>
        <p className="mt-2 text-sm text-white/60">Your people are closer than you think.</p>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="space-y-4 rounded-3xl border border-white/10 bg-vibe-card/70 p-6 backdrop-blur-xl shadow-card"
      >
        <h2 className="font-display text-xl font-semibold">Create your account</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should we call you?"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-white/50">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-vibe-coral"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-vibe-gradient py-3 text-sm font-semibold shadow-glow disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Sign up"}
        </motion.button>

        <p className="text-center text-sm text-white/50">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-vibe-coral">
            Log in
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
