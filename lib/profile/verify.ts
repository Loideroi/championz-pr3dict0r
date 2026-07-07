/**
 * Dual-path wallet signature verification (PRD §11, CLAUDE.md hard rule).
 *
 * The Socios.com Wallet is an ERC-1271 smart-contract account, so every
 * signature check branches contract-vs-EOA (predecessor's proven pattern):
 *
 *   1. hash the message with viem `hashMessage` (EIP-191 personal_sign hash)
 *   2. `getCode(address)` returns bytecode → contract wallet: call
 *      `isValidSignature(bytes32,bytes)` and expect the magic value
 *      0x1626ba7e
 *   3. no bytecode → EOA: recover the signer from the signature and compare
 *
 * ⚠️ Socios.com Wallet quirk (Biconomy MEE/Nexus, verified on mainnet
 * 2026-07-07): viem's `signMessage` sends `personal_sign` with the message
 * HEX-ENCODED per the JSON-RPC spec. A standard wallet decodes that hex back
 * to bytes and signs `eip191(bytes)`. The Socios wallet instead signs
 * `eip191` of the *literal hex string* ("0x4368…") — it never decodes. So we
 * verify against BOTH encodings (decoded string + `stringToHex(message)`) and
 * accept either. This also future-proofs: if the wallet is fixed to decode,
 * the plain-string encoding starts matching.
 *
 * Dependencies are injected so tests never touch a network.
 */
import { hashMessage, recoverMessageAddress, stringToHex } from "viem";

export const ERC1271_MAGIC_VALUE = "0x1626ba7e";

export const ERC1271_ABI = [
  {
    type: "function",
    name: "isValidSignature",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "bytes4" }],
  },
] as const;

export type Hex = `0x${string}`;

/** Injected chain/crypto access — mocked in tests, viem-backed in the route. */
export type VerifyDeps = {
  /** Deployed bytecode at `address`, or undefined/"0x" for an EOA. */
  getCode: (address: Hex) => Promise<Hex | undefined>;
  /** Call ERC-1271 isValidSignature on the contract; returns the bytes4. */
  callIsValidSignature: (
    address: Hex,
    hash: Hex,
    signature: Hex,
  ) => Promise<Hex>;
  /** EOA path: recover the personal_sign signer for `message`. */
  recoverSigner: (message: string, signature: Hex) => Promise<Hex>;
};

export type SignaturePath = "erc1271" | "eoa";

/** Pure branch selection: bytecode present → contract wallet. */
export function selectSignaturePath(bytecode: Hex | undefined): SignaturePath {
  return bytecode && bytecode !== "0x" ? "erc1271" : "eoa";
}

/**
 * The two ways a wallet may interpret the personal_sign payload for `message`:
 * the decoded UTF-8 string (standard) and the literal hex string viem sends
 * (Socios.com Wallet). Order matters only cosmetically — both are tried.
 */
export function messageEncodings(message: string): string[] {
  return [message, stringToHex(message)];
}

export type VerifyResult = { valid: boolean; path: SignaturePath };

/**
 * Verify that `signature` over `message` was produced by `address`,
 * via ERC-1271 for contract wallets and ecrecover for EOAs.
 */
export async function verifyWalletSignature(
  params: { address: Hex; message: string; signature: Hex },
  deps: VerifyDeps,
): Promise<VerifyResult> {
  const { address, message, signature } = params;
  const bytecode = await deps.getCode(address);
  const path = selectSignaturePath(bytecode);
  const encodings = messageEncodings(message);

  if (path === "erc1271") {
    // Try each encoding — the account's isValidSignature does its own
    // (possibly ERC-7739) rehashing, we just need to feed it the hash the
    // wallet actually signed.
    for (const enc of encodings) {
      try {
        const result = await deps.callIsValidSignature(
          address,
          hashMessage(enc),
          signature,
        );
        if (result?.toLowerCase().startsWith(ERC1271_MAGIC_VALUE)) {
          return { valid: true, path };
        }
      } catch {
        /* try the next encoding */
      }
    }
    return { valid: false, path };
  }

  for (const enc of encodings) {
    try {
      const signer = await deps.recoverSigner(enc, signature);
      if (signer.toLowerCase() === address.toLowerCase()) {
        return { valid: true, path };
      }
    } catch {
      /* try the next encoding */
    }
  }
  return { valid: false, path };
}

/** Default EOA recovery via viem (offline — no network). */
export async function recoverSignerViem(
  message: string,
  signature: Hex,
): Promise<Hex> {
  return recoverMessageAddress({ message, signature });
}
