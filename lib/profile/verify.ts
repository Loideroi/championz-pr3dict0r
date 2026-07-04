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
 * Dependencies are injected so tests never touch a network.
 */
import { hashMessage, recoverMessageAddress } from "viem";

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

  if (path === "erc1271") {
    try {
      const result = await deps.callIsValidSignature(
        address,
        hashMessage(message),
        signature,
      );
      return {
        valid: result?.toLowerCase().startsWith(ERC1271_MAGIC_VALUE) ?? false,
        path,
      };
    } catch {
      return { valid: false, path };
    }
  }

  try {
    const signer = await deps.recoverSigner(message, signature);
    return { valid: signer.toLowerCase() === address.toLowerCase(), path };
  } catch {
    return { valid: false, path };
  }
}

/** Default EOA recovery via viem (offline — no network). */
export async function recoverSignerViem(
  message: string,
  signature: Hex,
): Promise<Hex> {
  return recoverMessageAddress({ message, signature });
}
