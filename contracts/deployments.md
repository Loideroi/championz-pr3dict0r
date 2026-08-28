# Deployments

## Chiliz mainnet (88888) — PRODUCTION

- **Proxy (use this):** `0x742c6963a81012bc7949F0058Fba07c8d1A80c4d`
- Implementation (v6, verified): `0xD8d86bbfF76ce138eFC91C768dC6c350AF2728Af`
- Owner / feeRecipient: `0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8` (ADR-0005)
- Oracle (RESULT_ORACLE_ROLE): `0xB57Cb421E3B707d0970Ec758D40a4366DB317B15` — **⚠ fund
  with mainnet gas before the season so it can push results**
- resultSourceRef: `uefa-api:match.uefa.com/v5`
- League sales: **open** (deployed 2026-07-05) → close 2026-09-08 16:45 UTC (first MD1 kickoff)
- Knockout sales: 2026-09-08 16:45 UTC → 2027-02-17 20:00 UTC (adjustable via `setStageWindow` while SELLING, post-draw)
- Explorer: https://chiliscan.com/address/0x742c6963a81012bc7949F0058Fba07c8d1A80c4d
- Deployed with `scripts/deploy-mainnet.ts`.

**Post-deploy owner tasks (real tournament):**
1. Fund the oracle `0xB57C…` with mainnet CHZ gas.
2. After the 27 Aug draw: `generate-matches.mjs` → `verify-fixtures.mjs` →
   `scripts/add-fixtures.ts` (owner key, pause-bracketed, chunked, read-back verified;
   DRY RUN unless `CONFIRM=1`) → `verify-onchain.mjs` → `generate-map.mjs`. Knockout
   rounds + `setTies` follow each February draw. Full runbook: `STATUS.md`.
3. If launch timing shifts, adjust windows with `setStageWindow` (owner, while SELLING).
4. Point the mainnet frontend at the proxy (`NEXT_PUBLIC_PREDICTOR_ADDRESS` in Vercel prod).

## Chiliz Spicy testnet (88882) — STAGING

- Proxy: `0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6` (v6; impl `0x45d2…6f86`)
- Trophy: `0xFe6112BFBA2Ec16ddA0E4b079865d7A7d0892F02`
- Owner/oracle: same addresses as mainnet (staging deployer 0x4710).

## v7 upgrade — 2026-07-08 (winner-gated decider bonuses)

Scoring change (PRD §5.2 amendment): ET + penalties bonuses now require the
correct 90' outcome; advancer bonus unchanged. Storage layout untouched.

| network | proxy | new impl |
|---|---|---|
| chiliz (88888) | `0x742c6963a81012bc7949F0058Fba07c8d1A80c4d` | `0x09FeC2eA6f5a1EeA5171cb0ffBC65Dcf76ed72f6` |
| spicy (88882) | `0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6` | `0x888e98fC6ecEe5C8A086003956Cf7DAb7493bBd7` |

EXPECTED_IMPL updated in oracle-bot.yml for both chains (sentinel).
