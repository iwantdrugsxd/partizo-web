"use client";

import { useSettings } from "@/context/SettingsContext";

/**
 * Soft animated gradient blobs used behind auth / onboarding screens.
 * Automatically disabled in low-data mode to save battery + bandwidth on
 * budget Android devices.
 */
export default function AnimatedBackground() {
  const { lowDataMode } = useSettings();

  if (lowDataMode) {
    return (
      <div className="absolute inset-0 -z-10 bg-vibe-ink">
        <div className="absolute inset-0 bg-vibe-gradient-soft opacity-40" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-vibe-ink">
      <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-vibe-coral/40 blur-3xl animate-blob" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-vibe-purple/40 blur-3xl animate-blob [animation-delay:2s]" />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-vibe-orange/30 blur-3xl animate-blob [animation-delay:4s]" />
    </div>
  );
}
