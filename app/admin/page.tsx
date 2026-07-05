import { AdminPanel } from "./AdminPanel";

export const metadata = {
  title: "Admin — ₵h@mpi0nz Pr3dict0r",
};

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Exceptions only — the routine runs itself
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        Admin console
      </h1>
      <AdminPanel />
    </main>
  );
}
