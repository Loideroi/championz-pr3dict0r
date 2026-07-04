import { StandingsPanel } from "./StandingsPanel";

export const metadata = {
  title: "Standings — ₵h@mpi0nz Pr3dict0r",
};

export default function StandingsPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Two boards pay · one crown rules
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        Standings
      </h1>
      <StandingsPanel />
    </main>
  );
}
