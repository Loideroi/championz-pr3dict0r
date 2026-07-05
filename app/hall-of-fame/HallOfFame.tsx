"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePublicClient } from "wagmi";

const TROPHY_ADDRESS = (process.env.NEXT_PUBLIC_TROPHY_ADDRESS ?? "") as `0x${string}`;

const TROPHY_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "seasonOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface Champion {
  tokenId: number;
  owner: string;
  season: string;
}

export function HallOfFame() {
  const t = useTranslations("hallOfFame");
  const client = usePublicClient();
  const [champions, setChampions] = useState<Champion[] | null>(null);

  useEffect(() => {
    if (!client || !TROPHY_ADDRESS) return;
    const t = setTimeout(async () => {
      try {
        const nextId = Number(
          await client.readContract({ address: TROPHY_ADDRESS, abi: TROPHY_ABI, functionName: "nextId" }),
        );
        const found: Champion[] = [];
        for (let id = 1; id < nextId; id++) {
          const [owner, season] = await Promise.all([
            client.readContract({ address: TROPHY_ADDRESS, abi: TROPHY_ABI, functionName: "ownerOf", args: [BigInt(id)] }),
            client.readContract({ address: TROPHY_ADDRESS, abi: TROPHY_ABI, functionName: "seasonOf", args: [BigInt(id)] }),
          ]);
          found.push({ tokenId: id, owner: owner as string, season: season as string });
        }
        setChampions(found);
      } catch {
        setChampions([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [client]);

  if (!TROPHY_ADDRESS) {
    return <p className="font-mono text-sm text-muted">{t("notConfigured")}</p>;
  }
  if (champions === null) {
    return <p className="font-mono text-sm text-muted">{t("reading")}</p>;
  }
  if (champions.length === 0) {
    return (
      <div className="max-w-md rounded-2xl border border-star/30 bg-star/5 p-8">
        <p className="text-5xl">🏆</p>
        <p className="mt-4 font-mono text-sm text-muted">{t("emptyPlinth")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {champions.map((c) => (
        <div key={c.tokenId} className="rounded-2xl border border-star/40 bg-star/10 p-8">
          <p className="text-5xl">👑</p>
          <p className="mt-3 font-display text-xl font-black uppercase">{t("season", { season: c.season })}</p>
          <p className="mt-1 font-mono text-sm text-star">
            {c.owner.slice(0, 6)}…{c.owner.slice(-4)}
          </p>
          <p className="mt-2 font-mono text-xs text-muted-2">{t("trophyMeta", { id: c.tokenId })}</p>
        </div>
      ))}
    </div>
  );
}
