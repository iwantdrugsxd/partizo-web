"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import { IconSpark, IconCompass, IconChat, IconBell, IconUser } from "@/components/icons";

const ITEMS = [
  { href: "/connect", label: "Connect", icon: IconSpark },
  { href: "/outings", label: "Outings", icon: IconCompass },
  { href: "/chats", label: "Chats", icon: IconChat },
  { href: "/notifications", label: "Alerts", icon: IconBell },
  { href: "/profile", label: "Profile", icon: IconUser },
];

export default function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-vibe-ink/90 backdrop-blur-xl">
      <div className="flex items-center justify-around px-2 py-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link key={href} href={href} className="relative flex flex-1 flex-col items-center gap-1 py-1">
              {active && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute -top-1 h-1 w-8 rounded-full bg-vibe-gradient"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative">
                <Icon
                  className={clsx("h-5 w-5", active ? "text-white" : "text-white/40")}
                />
                {label === "Alerts" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vibe-coral px-1 text-[9px] font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={clsx("text-[10px] font-medium", active ? "text-white" : "text-white/40")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
