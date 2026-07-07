"use client";

import { useEffect, useRef, useState } from "react";
import { projectToBox } from "@/lib/geo";
import { IconMapPin } from "@/components/icons";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  coords: { lat: number; lng: number } | null;
  onPickCoords: (coords: { lat: number; lng: number }) => void;
}

/**
 * Free, keyless address search via OpenStreetMap's public Nominatim API - no
 * Google Maps billing account required. A production app at real scale should
 * proxy this through its own backend to respect Nominatim's usage policy.
 */
export default function LocationSearch({ value, onChange, coords, onPickCoords }: Props) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(value)}`
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function pickResult(r: NominatimResult) {
    onChange(r.display_name.split(",").slice(0, 3).join(",").trim());
    onPickCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setResults([]);
    setOpen(false);
  }

  const pin = coords ? projectToBox(coords, {
    minLat: coords.lat - 0.01,
    maxLat: coords.lat + 0.01,
    minLng: coords.lng - 0.01,
    maxLng: coords.lng + 0.01,
  }) : null;

  return (
    <div className="relative">
      <div className="relative">
        <IconMapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          required
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search for an address or venue..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm outline-none focus:border-vibe-coral"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-vibe-coral" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-vibe-card shadow-card">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pickResult(r)}
              className="flex w-full items-start gap-2 border-b border-white/5 px-3 py-2.5 text-left text-xs last:border-b-0 hover:bg-white/5"
            >
              <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vibe-coral" />
              <span className="text-white/80">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {coords && pin && (
        <div
          className="relative mt-2 h-28 overflow-hidden rounded-xl border border-white/10"
          style={{
            backgroundColor: "#161225",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
          >
            <span className="rounded-full bg-vibe-gradient p-1.5 shadow-glow">
              <IconMapPin className="h-3.5 w-3.5 text-white" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
