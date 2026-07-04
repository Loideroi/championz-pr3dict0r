import { HallOfFame } from "./HallOfFame";

export const metadata = {
  title: "Hall of Fame — ₵h@mpi0nz Pr3dict0r",
};

export default function HallOfFamePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-star">
        ★ Eternal glory, zero funds attached
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        Hall of Fame
      </h1>
      <HallOfFame />
    </main>
  );
}
