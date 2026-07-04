import { ENTRY, formatChz } from "@/lib/economics";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        ★ UEFA Champions League 2026/27
      </p>
      <h1 className="font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
        ₵h@mpi0nz
        <br />
        <span className="bg-gradient-to-b from-[#cfe0ff] via-glow-2 to-glow bg-clip-text text-transparent">
          Pr3dict0r
        </span>
      </h1>
      <p className="max-w-xl text-muted">
        Stake CHZ, call the 90-minute scorelines, and climb two leaderboards
        from matchday one to Madrid — while a UEFA-fed oracle does the admin
        work.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
        <span className="rounded-full border border-line px-4 py-2">
          Full Season · {formatChz(ENTRY.fullSeason.gross)} CHZ
        </span>
        <span className="rounded-full border border-line px-4 py-2">
          Knockout · {formatChz(ENTRY.knockout.gross)} CHZ
        </span>
      </div>
      <div className="flex gap-3">
        <a
          href="/enter"
          className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-6 py-3 font-semibold text-white"
        >
          Enter the pool →
        </a>
        <a
          href="/play"
          className="rounded-xl border border-line px-6 py-3 font-semibold text-ink"
        >
          Predict
        </a>
        <a
          href="/standings"
          className="rounded-xl border border-line px-6 py-3 font-semibold text-ink"
        >
          Standings
        </a>
      </div>
    </main>
  );
}
