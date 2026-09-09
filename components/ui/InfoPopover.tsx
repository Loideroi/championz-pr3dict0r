"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A tap-to-open explainer: a small round "i" button and a card beneath it.
 * Click-toggled, never hover-only — most of the board is read on a phone.
 * Closes on Escape, on a tap outside, or via its own Close button, which takes
 * focus on open so keyboard and screen-reader users land inside the dialog.
 * Content is the caller's (children), so the component carries no copy.
 *
 * Mount it outside any `overflow-x-auto` wrapper: the card is absolutely
 * positioned and a scrolling ancestor would clip it.
 */
export function InfoPopover({
  label,
  title,
  closeLabel,
  moreHref,
  moreLabel,
  align = "end",
  children,
}: {
  /** Accessible name of the trigger, e.g. "How scoring works". */
  label: string;
  title: string;
  closeLabel: string;
  /** Optional deep link to the full rule text (e.g. /terms#scoring). */
  moreHref?: string;
  moreLabel?: string;
  /** Which edge of the trigger the card hangs from. */
  align?: "start" | "end";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] leading-none transition-colors ${
          open ? "border-glow-2 text-glow-2" : "border-line text-muted hover:border-muted hover:text-ink"
        }`}
      >
        i
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-labelledby={`${id}-title`}
          className={`absolute top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-night-2 p-4 text-left text-sm shadow-xl ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <p id={`${id}-title`} className="mb-3 font-mono text-[10px] uppercase tracking-widest text-glow-2">
            {title}
          </p>
          {children}
          <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
            {moreHref && moreLabel ? (
              <Link href={moreHref} className="text-glow-2 underline-offset-2 hover:underline">
                {moreLabel}
              </Link>
            ) : (
              <span />
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-line px-3 py-1 text-muted hover:text-ink"
            >
              {closeLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
