import type { MetadataRoute } from "next";

/** Explicit crawl policy — a reputation signal for Safe-Browsing-style scanners. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: "https://pr3dict0r.com/sitemap.xml",
  };
}
