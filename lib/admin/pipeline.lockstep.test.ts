import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as relayer from "../../relayer/src/matchday";
import { RUNNERS } from "./health";
import * as app from "./pipeline";

/**
 * lib/admin/pipeline.ts is a port of relayer/src/matchday.ts (the app cannot
 * import the relayer package at runtime). This test is the lockstep: a change
 * to the runner's coverage window that is not mirrored here fails CI instead
 * of letting /admin describe a different window from production automation.
 */
describe("matchday coverage — app port stays in lockstep with the relayer", () => {
  it("shares the three constants", () => {
    expect(app.LOCK_LEAD_SECONDS).toBe(relayer.LOCK_LEAD_SECONDS);
    expect(app.COVERAGE_OPEN_BEFORE_LOCK_SECONDS).toBe(relayer.COVERAGE_OPEN_BEFORE_LOCK_SECONDS);
    expect(app.COVERAGE_TAIL_AFTER_KICKOFF_SECONDS).toBe(relayer.COVERAGE_TAIL_AFTER_KICKOFF_SECONDS);
  });

  it("computes the same span over a real matchday shape and around its edges", () => {
    const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
    const slot = (d: string) => [at(`2026-09-${d}T16:45:00Z`), at(`2026-09-${d}T19:00:00Z`), at(`2026-09-${d}T19:00:00Z`)];
    const kickoffs = [...slot("08"), ...slot("09"), ...slot("10"), 0];
    const probes = [
      "2026-09-08T00:00:00Z", "2026-09-08T11:44:59Z", "2026-09-08T11:45:00Z", "2026-09-08T21:29:59Z",
      "2026-09-08T21:30:00Z", "2026-09-09T12:00:00Z", "2026-09-10T23:00:00Z", "2026-09-30T00:00:00Z",
    ];
    for (const p of probes) {
      const now = at(p);
      expect(app.matchdayKickoffs(kickoffs, now)).toEqual(relayer.matchdayKickoffs(kickoffs, now));
      expect(app.matchdaySpan(kickoffs, now)).toEqual(relayer.matchdaySpan(kickoffs, now));
    }
  });

  it("keeps the --runner allowlist in relay.mjs identical to the app's Runner union", () => {
    const src = readFileSync(new URL("../../relayer/scripts/relay.mjs", import.meta.url), "utf8");
    const m = /const RUNNERS = \[([^\]]+)\]/.exec(src);
    const inScript = (m?.[1] ?? "").split(",").map((x) => x.trim().replace(/['"]/g, ""));
    expect(inScript).toEqual([...RUNNERS]);
  });
});
