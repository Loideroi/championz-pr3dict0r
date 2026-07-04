import { PlayPanel } from "./PlayPanel";

export const metadata = {
  title: "Play — ₵h@mpi0nz Pr3dict0r",
};

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Matchday slate · Spicy testnet
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        Call every scoreline
      </h1>
      <p className="max-w-md text-center text-sm text-muted">
        Dial your 90-minute scorelines, lock the whole matchday in one transaction,
        and edit any pick freely until 60 minutes before its kickoff — changing
        your mind just re-pays cents of gas.
      </p>
      <PlayPanel />
    </main>
  );
}
