"use client";

import { useState } from "react";
import Link from "next/link";
import { Outing } from "@/lib/types";
import { projectToBox } from "@/lib/geo";
import { IconMapPin } from "@/components/icons";

interface Props {
  outings: Outing[];
}

/**
 * Lightweight, dependency-free pseudo-map: pins are positioned by normalized
 * lat/lng within a bounding box over a stylized grid background. Not a real
 * tile-based map (no Google Maps/Mapbox key required for this demo).
 */
export default function OutingMapView({ outings }: Props) {
  const [active, setActive] = useState<Outing | null>(null);
  const withCoords = outings.filter((o) => o.lat !== undefined && o.lng !== undefined);

  if (withCoords.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/40">
        No location data to show on the map yet.
      </div>
    );
  }

  const lats = withCoords.map((o) => o.lat!);
  const lngs = withCoords.map((o) => o.lng!);
  const pad = 0.05;
  const bounds = {
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad,
    maxLng: Math.max(...lngs) + pad,
  };

  return (
    <div className="relative">
      <div
        className="relative h-80 overflow-hidden rounded-2xl border border-white/10"
        style={{
          backgroundColor: "#161225",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {withCoords.map((o) => {
          const { x, y } = projectToBox({ lat: o.lat!, lng: o.lng! }, bounds);
          return (
            <button
              key={o.id}
              onClick={() => setActive(o)}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            >
              <span className="rounded-full bg-vibe-gradient p-1.5 shadow-glow">
                <IconMapPin className="h-4 w-4 text-white" />
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-vibe-card/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-vibe-orange">{active.category}</p>
          <p className="mb-1 text-sm font-bold">{active.title}</p>
          <p className="mb-2 text-xs text-white/50">{active.location}</p>
          <Link href={`/outings/${active.id}`} className="text-xs font-semibold text-vibe-coral">
            View outing →
          </Link>
        </div>
      )}
    </div>
  );
}
