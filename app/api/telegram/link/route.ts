/**
 * /api/telegram/link — signature-verified Telegram linking (slice 10, PRD §12).
 * POST   { address, chainId, message, signature } → { deepLink, expiresAt }
 * DELETE { address, chainId, message, signature } → unlink (clears both fields)
 *
 * Message format (10-min freshness; ASCII-only — multibyte chars break the
 * Socios wallet's signed bytes, see lib/profile/validate.ts):
 *   "Ch@mpi0nz Pr3dict0r telegram-link: <address> | <chainId> | <ISO timestamp>"
 * Same dual EOA / ERC-1271 verification as /api/profile. Strictly opt-in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { getServiceRoleClient } from "@/lib/supabase/server";
import { isHexAddress, isSupportedChainId } from "@/lib/profile/validate";
import {
  ERC1271_ABI,
  recoverSignerViem,
  verifyWalletSignature,
  type Hex,
} from "@/lib/profile/verify";
import {
  createLinkCode,
  unlinkTelegram,
  LINK_CODES_TABLE,
  type LinkDb,
} from "@/lib/telegram/link";
import { PROFILES_TABLE } from "@/lib/profile/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESHNESS_MS = 10 * 60 * 1000;

function rpcClient() {
  const url =
    process.env.CHILIZ_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://spicy-rpc.chiliz.com";
  return createPublicClient({ transport: http(url) });
}

function verifySignature(params: { address: Hex; message: string; signature: Hex }) {
  const client = rpcClient();
  return verifyWalletSignature(params, {
    getCode: async (address) => client.getCode({ address }),
    callIsValidSignature: async (address, hash, signature) =>
      (await client.readContract({
        address,
        abi: ERC1271_ABI,
        functionName: "isValidSignature",
        args: [hash, signature],
      })) as Hex,
    recoverSigner: recoverSignerViem,
  });
}

function supabaseLinkDb(): LinkDb | null {
  const sb = getServiceRoleClient();
  if (!sb) return null;
  return {
    async insertCode(row) {
      const { error } = await sb.from(LINK_CODES_TABLE).insert(row);
      return error ? { error: error.message } : {};
    },
    async findCode(code) {
      const { data } = await sb
        .from(LINK_CODES_TABLE)
        .select("wallet_address, chain_id, expires_at")
        .eq("code", code)
        .maybeSingle();
      return data ?? null;
    },
    async deleteCode(code) {
      await sb.from(LINK_CODES_TABLE).delete().eq("code", code);
    },
    async setTelegram(wallet, chainId, tg) {
      const { error } = await sb
        .from(PROFILES_TABLE)
        .update(tg)
        .eq("wallet_address", wallet)
        .eq("chain_id", chainId);
      return error ? { error: error.message } : {};
    },
  };
}

async function verifiedWallet(request: NextRequest): Promise<
  | { address: Hex; chainId: number }
  | { status: number; error: string }
> {
  let body: { address?: string; chainId?: number; message?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return { status: 400, error: "Invalid JSON body." };
  }
  const { address, chainId, message, signature } = body;
  if (!address || !isHexAddress(address) || !isSupportedChainId(Number(chainId))) {
    return { status: 400, error: "address and chainId (88882|88888) are required." };
  }
  if (!message || !signature) return { status: 400, error: "message and signature are required." };
  // ASCII-only prefix — multibyte chars break Socios wallet signature bytes
  // (see lib/profile/validate.ts PROFILE_MESSAGE_PREFIX).
  const expectedPrefix = `Ch@mpi0nz Pr3dict0r telegram-link: ${address.toLowerCase()} | ${chainId} | `;
  if (!message.toLowerCase().startsWith(expectedPrefix.toLowerCase())) {
    return { status: 400, error: "Message does not match the expected format." };
  }
  const timestampIso = message.slice(expectedPrefix.length);
  const age = Date.now() - new Date(timestampIso).getTime();
  if (!Number.isFinite(age) || age < 0 || age > FRESHNESS_MS) {
    return { status: 400, error: "Message expired — sign a fresh one." };
  }
  const verdict = await verifySignature({
    address: address as Hex,
    message,
    signature: signature as Hex,
  });
  if (!verdict.valid) return { status: 401, error: "Signature verification failed." };
  return { address: address as Hex, chainId: Number(chainId) };
}

export async function POST(request: NextRequest) {
  const db = supabaseLinkDb();
  if (!db) return NextResponse.json({ error: "Linking not configured." }, { status: 503 });
  const who = await verifiedWallet(request);
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status });
  const res = await createLinkCode(db, who.address, who.chainId, Date.now());
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ deepLink: res.deepLink, expiresAt: res.expiresAt });
}

export async function DELETE(request: NextRequest) {
  const db = supabaseLinkDb();
  if (!db) return NextResponse.json({ error: "Linking not configured." }, { status: 503 });
  const who = await verifiedWallet(request);
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status });
  const { ok } = await unlinkTelegram(db, who.address, who.chainId);
  return ok
    ? NextResponse.json({ unlinked: true })
    : NextResponse.json({ error: "Unlink failed." }, { status: 500 });
}
