# ₵h@mpi0nz Pr3dict0r

Stake CHZ, predict the 90-minute scorelines of the **UEFA Champions League 2026/27**,
and climb two leaderboards from matchday one to the final in Madrid — on Chiliz Chain,
with results set automatically from UEFA's own data feed.

- **Spec:** [PRD.md](./PRD.md) (master) · [PRD.html](./PRD.html) (readable mirror)
- **Build plan:** [.scratch/championz-predictor/](./.scratch/championz-predictor/README.md) — 16 vertical slices
- **Agents:** read [CLAUDE.md](./CLAUDE.md) first · workflow in [CONTRIBUTING.md](./CONTRIBUTING.md)

## The pitch

- **Full Season pass — 1,100 CHZ** (until MD1 kickoff): predict all 189 matches,
  compete for the League Pool *and* the Knockout Pool.
- **Knockout pass — 550 CHZ** (on sale from MD1 kickoff): join late, compete for the
  Knockout Pool from zero — same matches, same money, same odds as everyone else.
- Scoring: 5 exact / 3 goal-difference / 1 outcome, on the **90-minute score**, plus
  extra-time / penalties / advancing-team bonuses on knockout deciders.
- Predictions editable until 60 minutes before kickoff (you just re-pay ~$0.05 gas).
- Top-20 of each stage split its pool: 25% / 15% / 10% / 30%÷7 / 20%÷10.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test && npm run typecheck && npm run build
```

Copy `.env.example` → `.env.local` for real chain/API keys (everything runs without
them during slice 01).

## Workspaces

- `app/`, `lib/` — Next.js 16 frontend (this package)
- `contracts/` — ChampionzPredictor.sol (Hardhat, slice 02+)
- `relayer/` — UEFA results oracle on GitHub Actions (slices 04–06)

---

Design inspired by **BigMac Bobby** · Built on Chiliz Chain · Not affiliated with or
endorsed by UEFA.
