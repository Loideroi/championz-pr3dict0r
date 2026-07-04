import { PlayPanel } from "./PlayPanel";

export const metadata = {
  title: "Play — ₵h@mpi0nz Pr3dict0r",
};

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Walking skeleton · Spicy testnet
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        One match, end to end
      </h1>
      <p className="max-w-md text-center text-sm text-muted">
        Connect (Socios.com Wallet supported), pay the exact 550 CHZ entry, dial a
        scoreline, and edit it freely until 60 minutes before kickoff.
      </p>
      <PlayPanel />
    </main>
  );
}
