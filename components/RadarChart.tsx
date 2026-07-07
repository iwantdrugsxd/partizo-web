"use client";

import { TraitKey, TraitVector } from "@/lib/types";

interface Props {
  me: TraitVector;
  them: TraitVector;
  labels: { key: TraitKey; label: string }[];
}

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 78;

function pointFor(index: number, total: number, value: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 10) * RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(values: number[]) {
  return values.map((v, i) => pointFor(i, values.length, v)).map((p) => `${p.x},${p.y}`).join(" ");
}

export default function RadarChart({ me, them, labels }: Props) {
  const meValues = labels.map(({ key }) => me[key]);
  const themValues = labels.map(({ key }) => them[key]);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-56 w-56" style={{ overflow: "visible" }}>
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <polygon
            key={frac}
            points={polygonPoints(labels.map(() => frac * 10))}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        ))}
        {labels.map((l, i) => {
          const edge = pointFor(i, labels.length, 10);
          return (
            <line
              key={l.key}
              x1={CENTER}
              y1={CENTER}
              x2={edge.x}
              y2={edge.y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          );
        })}
        <polygon points={polygonPoints(themValues)} fill="rgba(255,122,89,0.25)" stroke="#ff7a59" strokeWidth={1.5} />
        <polygon points={polygonPoints(meValues)} fill="rgba(139,124,255,0.2)" stroke="#8b7cff" strokeWidth={1.5} />
        {labels.map((l, i) => {
          const p = pointFor(i, labels.length, 12.6);
          const anchor = p.x < CENTER - 10 ? "end" : p.x > CENTER + 10 ? "start" : "middle";
          return (
            <text
              key={l.key}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
            >
              {l.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-vibe-purple" style={{ backgroundColor: "#8b7cff" }} /> You
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#ff7a59" }} /> Them
        </span>
      </div>
    </div>
  );
}
