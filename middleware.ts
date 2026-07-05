import { NextResponse, type NextRequest } from "next/server";

/**
 * Geo-fencing (slice 16, ADR-0007). Reuses Fanbet's accepted mitigation: a
 * hard HTTP 451 for a fixed jurisdiction list, paired with the T&C eligibility
 * self-certification. This is an ENGINEERING MITIGATION, NOT LEGAL ADVICE —
 * see docs/adr/0007-geofence-fanbet-block.md.
 *
 * Country comes from the edge platform's geo header (Vercel sets
 * `x-vercel-ip-country`). Absent header (local dev, non-Vercel) → allow, since
 * the block is defence-in-depth over the T&C clause, not the only gate.
 */
export const BLOCKED_COUNTRIES = [
  "CN", "BD", "DZ", "EG", "NP", "AF", "KP", "IQ", "IR", "AE", "ID", "VN", "QA", "SG",
] as const;

export function countryFromRequest(request: NextRequest): string | null {
  // Vercel edge geo header; fall back to the platform geo object if present.
  return (
    request.headers.get("x-vercel-ip-country") ??
    // @ts-expect-error – geo is populated on Vercel's edge runtime
    (request.geo?.country as string | undefined) ??
    null
  );
}

export function isBlocked(country: string | null): boolean {
  return country !== null && (BLOCKED_COUNTRIES as readonly string[]).includes(country.toUpperCase());
}

export function middleware(request: NextRequest) {
  if (isBlocked(countryFromRequest(request))) {
    return new NextResponse(
      "Not available in your region. This is a skill-based prediction pool, and access from your jurisdiction is restricted. See our Terms for eligibility.",
      { status: 451, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return NextResponse.next();
}

export const config = {
  // Guard pages + the entry/claim API; skip static assets and the health/telegram
  // webhooks (Telegram's servers aren't geo-relevant and must always reach us).
  matcher: [
    "/",
    "/enter/:path*",
    "/play/:path*",
    "/standings/:path*",
    "/profile/:path*",
    "/api/profile/:path*",
  ],
};
