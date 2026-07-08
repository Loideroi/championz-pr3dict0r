import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes the dApp installable (Android install prompt + iOS
 * Add-to-Home-Screen). Icons are the nav's blue-box-white-star mark; the
 * maskable variant is full-bleed so Android's circular crop keeps the
 * gradient behind the star.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "₵h@mpi0nz Pr3dict0r",
    short_name: "Pr3dict0r",
    description:
      "UEFA Champions League 2026/27 prediction pool on Chiliz Chain",
    start_url: "/",
    scope: "/",
    lang: "en",
    dir: "ltr",
    categories: ["sports", "games"],
    display: "standalone",
    orientation: "portrait",
    background_color: "#060a1a",
    theme_color: "#060a1a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
