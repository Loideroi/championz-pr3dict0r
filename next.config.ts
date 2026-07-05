import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cookie-based i18n (no locale routing) — request config in i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
