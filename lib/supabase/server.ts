/**
 * Server-only Supabase client using the service-role key (PRD §13.2).
 *
 * All clp_ tables have RLS with public SELECT and no anon write policies —
 * every write flows through this client inside server routes / the relayer.
 * NEVER import this from client components: the module throws in a browser
 * bundle as a tripwire, and the service-role key is a server-only env var.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase/server.ts must never be imported client-side.");
}

let cached: SupabaseClient | null = null;

/**
 * Returns the service-role client, or null when the env is not configured
 * (local dev without .env.local, CI) so callers can 503 gracefully.
 */
export function getServiceRoleClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
