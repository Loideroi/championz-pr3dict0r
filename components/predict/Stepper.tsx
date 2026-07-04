"use client";

import { MAX_GOALS } from "@/lib/predictor/packed";

/** Scoreboard stepper — the ▲▼ input pattern from the walking skeleton. */
export function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`${label} score up`}
        disabled={disabled}
        onClick={() => onChange(Math.min(MAX_GOALS, value + 1))}
        className="h-6 w-9 rounded-md border border-line bg-white/5 text-xs hover:bg-glow disabled:opacity-40"
      >
        ▲
      </button>
      <span className="font-mono text-2xl font-bold text-glow-2">{value}</span>
      <button
        type="button"
        aria-label={`${label} score down`}
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-6 w-9 rounded-md border border-line bg-white/5 text-xs hover:bg-glow disabled:opacity-40"
      >
        ▼
      </button>
    </div>
  );
}
