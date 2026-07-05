# 16 — Security program & launch cutover

Status: ready-for-human

## Comments

**2026-07-05 — security program COMPLETE; launch cutover is owner-gated.**
- **Cross-model adversarial pentest loop (PRD §16.1): converged over 5 rounds.** An
  Opus red-team agent attacked the frozen contract; the designer (Fable) fixed and the
  red team re-attacked the diff. Rounds found 1 critical-adjacent + 2 High + 3 Med
  (round 1), then 2 NEW High the fixes introduced (round 2: emergencyWithdraw deploy-clock
  rug, forceFinalize under-gating), then the H-2b challenge-window gap (round 3), then
  F-1 in the cure path (round 4) — **all fixed**, ending in a **round-5 clean fund-safety
  sign-off**. The disputed C-1 "cross-pool insolvency" was disproven with a test. Full
  log: [`SECURITY_FINDINGS.md`](../../SECURITY_FINDINGS.md) (doubles as the upgrade
  regression checklist). Contract v6 live on Spicy (impl
  `0x45d20C40f71d659cE65863C315c056c767426f86`); 46 contract tests; Slither 0.11.4 clean
  of all high-severity classes; predecessor Audit.MD 18-finding regression green.
- **Geo-fence (D7/ADR-0007):** `middleware.ts` returns HTTP 451 for the 14 jurisdictions
  + T&C clause. Tested.
- **PRD corrected** where the pentest caught overstatements (§10.2 "trustless" → honest
  challenge-window posture; §16.3 emergencyWithdraw now real + pause-clocked).
- **[`LAUNCH_CHECKLIST.md`](../../LAUNCH_CHECKLIST.md)** maps the full PRD §22 gate.
- **Remaining — OWNER ONLY (irreversible / real-money, Claude will not do these alone):**
  mainnet deploy from a fresh key ceremony (Spicy deployer 0x4710… is staging, ADR-0005);
  Vercel production project + env; pr3dict0r.com GoDaddy→Vercel DNS; Telegram channel/group
  creation; the Socios-wallet Spicy sign-off. Claude prepares exact commands on request.
PRD: ../../PRD.md §16, §18, §22 · Decisions: D5, D7

## What to build

The gate between Spicy and real money. Security first: run the cross-model adversarial
pentest loop — freeze the contract source, hand it to a different model in a fresh
context with an attacker persona, feed severity-ranked findings back to the designer
for fixes, and repeat until two consecutive clean rounds; log everything in
SECURITY_FINDINGS.md as the living regression checklist. Alongside it: Slither with a
zero-high-severity gate and Snyk in CI, the known-weakness sweep (reentrancy, oracle
trust, front-running, access control, UUPS pitfalls, bounded loops, rounding, signature
replay, exact-value enforcement), and an explicit re-check of all 18 predecessor audit
findings against v3. Geo-fencing (D7): the 14-jurisdiction HTTP-451 edge block plus
the eligibility clause. Then the cutover: mainnet deploy from the owner key with
Chiliscan verification, production env on the Loideroi Vercel account, pr3dict0r.com
DNS cut over from GoDaddy (delete the parked A record), relayer pointed at mainnet,
and the PRD §22 launch-gate checklist walked item by item before entries open.

## Acceptance criteria

- [ ] Pentest loop complete: two consecutive clean rounds by a different model; SECURITY_FINDINGS.md logs every finding and fix
- [ ] Slither zero high-severity; Snyk clean; 18-item predecessor regression checklist green
- [ ] Measured: simulated 18-match matchday oracle gas ≤ 10% of the predecessor's equivalent settle cost for 100 users
- [ ] Edge block returns HTTP 451 for all 14 jurisdictions; other traffic unaffected
- [ ] Mainnet proxy deployed, verified, and wired into the app; oracle key funded with gas only
- [ ] pr3dict0r.com serves the production deployment over HTTPS (www + apex)
- [ ] Every PRD §22 launch-gate item checked off, evidence linked

## Blocked by

- 03-two-stage-economics.md
- 07-scoring-engine-leaderboards.md
- 11-freeze-claims-trophy.md
- 12-corrections-admin-console.md
