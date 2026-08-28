import { ethers, network } from "hardhat";

/**
 * Align the sales windows with the published calendar (PRD §4.1, D1/D4):
 * league sales hard-close AT the first MD1 kickoff; knockout sales open at
 * that same instant. Owner-only, SELLING stages only, DRY RUN by default.
 *
 *   PROXY=0x… LEAGUE_CLOSE=<unix> [KO_OPEN=<unix>] [KO_CLOSE=<unix>] [CONFIRM=1] \
 *   npx hardhat run scripts/set-stage-windows.ts --network chiliz
 *
 * Ordering respects the contract's cross-stage invariant (M-3):
 * league.closeAt ≤ knockout.openAt — so extending the league window moves the
 * knockout window FIRST; shrinking it moves the league window first.
 */
const env = (k: string) => process.env[k];

async function main() {
  const proxy = env("PROXY");
  const leagueCloseRaw = env("LEAGUE_CLOSE");
  if (!proxy || !leagueCloseRaw) throw new Error("Set PROXY=0x… and LEAGUE_CLOSE=<unix seconds>");
  const confirm = env("CONFIRM") === "1";

  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const [league, ko] = await Promise.all([c.stages(0), c.stages(1)]);
  const cur = {
    leagueOpen: Number(league.openAt),
    leagueClose: Number(league.closeAt),
    koOpen: Number(ko.openAt),
    koClose: Number(ko.closeAt),
  };
  const next = {
    leagueOpen: cur.leagueOpen,
    leagueClose: Number(leagueCloseRaw),
    koOpen: Number(env("KO_OPEN") ?? leagueCloseRaw),
    koClose: Number(env("KO_CLOSE") ?? cur.koClose),
  };

  console.log(`=== set-stage-windows — ${network.name} ${confirm ? "BROADCAST" : "DRY RUN"} ===`);
  console.log(`league:   ${iso(cur.leagueOpen)} → ${iso(cur.leagueClose)}   ⇒   ${iso(next.leagueOpen)} → ${iso(next.leagueClose)}`);
  console.log(`knockout: ${iso(cur.koOpen)} → ${iso(cur.koClose)}   ⇒   ${iso(next.koOpen)} → ${iso(next.koClose)}`);

  if (Number(league.status) !== 0 || Number(ko.status) !== 0) throw new Error("a stage is no longer SELLING — windows are final");
  if (next.leagueClose <= next.leagueOpen) throw new Error("league closeAt must be after openAt");
  if (next.koOpen < next.leagueClose) throw new Error("knockout openAt must be ≥ league closeAt (M-3 invariant)");
  if (next.koClose <= next.koOpen) throw new Error("knockout closeAt must be after openAt");
  const now = Math.floor(Date.now() / 1000);
  if (next.leagueClose <= now) throw new Error("league closeAt is in the past");

  const leagueChanged = next.leagueClose !== cur.leagueClose;
  const koChanged = next.koOpen !== cur.koOpen || next.koClose !== cur.koClose;
  if (!leagueChanged && !koChanged) {
    console.log("nothing to change");
    return;
  }

  // extending the league window → knockout first; shrinking → league first
  const koFirst = next.leagueClose > cur.koOpen;
  const steps: Array<() => Promise<void>> = [];
  const setLeague = async () => {
    console.log(`setStageWindow(LEAGUE, ${next.leagueOpen}, ${next.leagueClose})`);
    if (confirm) await (await c.setStageWindow(0, next.leagueOpen, next.leagueClose)).wait();
  };
  const setKo = async () => {
    console.log(`setStageWindow(KNOCKOUT, ${next.koOpen}, ${next.koClose})`);
    if (confirm) await (await c.setStageWindow(1, next.koOpen, next.koClose)).wait();
  };
  if (koFirst) {
    if (koChanged) steps.push(setKo);
    if (leagueChanged) steps.push(setLeague);
  } else {
    if (leagueChanged) steps.push(setLeague);
    if (koChanged) steps.push(setKo);
  }
  for (const step of steps) await step();

  if (!confirm) {
    console.log("\nDRY RUN — nothing broadcast. Re-run with CONFIRM=1.");
    return;
  }
  const [l2, k2] = await Promise.all([c.stages(0), c.stages(1)]);
  console.log(`\n✓ league ${iso(Number(l2.openAt))} → ${iso(Number(l2.closeAt))} · knockout ${iso(Number(k2.openAt))} → ${iso(Number(k2.closeAt))}`);
}

const iso = (unix: number) => new Date(unix * 1000).toISOString().replace(".000Z", "Z");

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
