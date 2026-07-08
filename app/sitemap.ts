import type { MetadataRoute } from "next";

const BASE = "https://pr3dict0r.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/enter", "/play", "/standings", "/hall-of-fame", "/terms", "/ios-install"].map(
    (path) => ({
      url: `${BASE}${path}`,
      changeFrequency: path === "" || path === "/standings" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.7,
    }),
  );
}
