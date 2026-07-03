# 16 — Security program & launch cutover

Status: ready-for-agent
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
