"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient floodlit starfield (BigMac Bobby mock, PRD §14). Purely decorative:
 * fixed, behind everything, aria-hidden. Honors prefers-reduced-motion by
 * drawing a single static frame (no twinkle loop).
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: { x: number; y: number; r: number; a: number; s: number }[] = [];
    let frame = 0;

    function size() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 1.2;
      stars = Array.from({ length: Math.min(140, Math.floor(window.innerWidth / 9)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random(),
        s: Math.random() * 0.018 + 0.004,
      }));
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) {
        if (!reduce) {
          st.a += st.s;
          if (st.a > 1 || st.a < 0) st.s *= -1;
        }
        ctx.globalAlpha = Math.abs(st.a) * 0.8 + 0.1;
        ctx.fillStyle = st.r > 1.1 ? "#9fc2ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, 7);
        ctx.fill();
      }
      if (!reduce) frame = requestAnimationFrame(draw);
    }

    size();
    draw();
    window.addEventListener("resize", size);
    return () => {
      window.removeEventListener("resize", size);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-80"
    />
  );
}
