"use client";

import { projectToBox } from "@/lib/geo";

interface SharePoint {
  uid: string;
  name: string;
  lat: number;
  lng: number;
}

interface Props {
  center: { lat: number; lng: number };
  shares: SharePoint[];
}

/** Same dependency-free pseudo-map pattern as OutingMapView, scoped to live-location pins. */
export default function LiveLocationMap({ center, shares }: Props) {
  const lats = [center.lat, ...shares.map((s) => s.lat)];
  const lngs = [center.lng, ...shares.map((s) => s.lng)];
  const pad = 0.02;
  const bounds = {
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad,
    maxLng: Math.max(...lngs) + pad,
  };
  const centerPos = projectToBox(center, bounds);

  return (
    <div
      className="relative h-48 overflow-hidden rounded-xl border border-white/10"
      style={{
        backgroundColor: "#161225",
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <div
        style={{ left: `${centerPos.x}%`, top: `${centerPos.y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 p-2"
      >
        <span className="block h-1.5 w-1.5 rounded-full bg-white/60" />
      </div>
      {shares.map((s) => {
        const { x, y } = projectToBox({ lat: s.lat, lng: s.lng }, bounds);
        return (
          <div
            key={s.uid}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center"
          >
            <span className="whitespace-nowrap rounded-full bg-vibe-gradient px-2 py-0.5 text-[10px] font-semibold shadow-glow">
              {s.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
