import { EnterPanel } from "./EnterPanel";

export const metadata = {
  title: "Enter — ₵h@mpi0nz Pr3dict0r",
};

export default function EnterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        The shop is never closed
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight text-center">
        Pick your pass
      </h1>
      <p className="max-w-lg text-center text-sm text-muted">
        Early birds play the whole season for 1,100 CHZ. Latecomers join the knockout
        for 550 CHZ the moment season sales close — same matches, same money, fresh
        leaderboard. Under 20 entrants in a stage? Everyone gets every wei back.
      </p>
      <EnterPanel />
    </main>
  );
}
