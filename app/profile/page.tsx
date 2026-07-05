import { ProfileForm } from "@/components/profile/ProfileForm";
import { LinkTelegram } from "@/components/profile/LinkTelegram";

export const metadata = {
  title: "Profile — ₵h@mpi0nz Pr3dict0r",
};

export default function ProfilePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Flags from day one
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight text-center">
        Claim your name
      </h1>
      <p className="max-w-lg text-center text-sm text-muted">
        The leaderboard shows a flag and a username, not a wallet address. Pick a
        handle (unique per chain), pick your colours, sign one message — done. No
        email, no password: your wallet is your login.
      </p>
      <ProfileForm />
      <LinkTelegram />
    </main>
  );
}
