"use client";

import { useState } from "react";

/**
 * Club crest with the PRD §7.6 fallback chain, never blank: the bundled
 * crest URL (img.uefa.com, from UEFA's own feed) → a monogram of the 3-letter
 * code. Plain <img onError> swap on purpose (Fanbet's 2026-05-29 lesson: no
 * Avatar composition). Decorative — the club name is always rendered beside
 * it, so the image is aria-hidden and the monogram carries no extra text.
 */
export function TeamCrest({
  code,
  name,
  src,
  size = 22,
}: {
  code: string;
  name: string;
  src: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party crest, onError fallback (PRD §7.6)
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-sm object-contain"
        style={{ width: size, height: size }}
        title={name}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-sm border border-line bg-white/5 font-mono text-[9px] font-bold uppercase tracking-tight text-muted"
      style={{ width: size, height: size }}
    >
      {code.slice(0, 3)}
    </span>
  );
}
