import { describe, expect, it, vi } from "vitest";
import { hashMessage, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ERC1271_MAGIC_VALUE,
  recoverSignerViem,
  selectSignaturePath,
  verifyWalletSignature,
  type Hex,
  type VerifyDeps,
} from "./verify";

const CONTRACT_WALLET = "0x1111111111111111111111111111111111111111" as Hex;
const MESSAGE = "Ch@mpi0nz Pr3dict0r profile: rikkert | NL | 2026-07-04T12:00:00.000Z";
const SIG = ("0x" + "ab".repeat(65)) as Hex;

function deps(overrides: Partial<VerifyDeps>): VerifyDeps {
  return {
    getCode: vi.fn(async () => undefined),
    callIsValidSignature: vi.fn(async () => "0x00000000" as Hex),
    recoverSigner: vi.fn(async () => "0x0000000000000000000000000000000000000000" as Hex),
    ...overrides,
  };
}

describe("selectSignaturePath", () => {
  it("routes bytecode to ERC-1271 and empty code to EOA", () => {
    expect(selectSignaturePath("0x6080abcd")).toBe("erc1271");
    expect(selectSignaturePath("0x")).toBe("eoa");
    expect(selectSignaturePath(undefined)).toBe("eoa");
  });
});

describe("verifyWalletSignature — ERC-1271 (contract wallet / Socios)", () => {
  it("accepts when isValidSignature returns the magic value", async () => {
    const callIsValidSignature = vi.fn(async () => ERC1271_MAGIC_VALUE as Hex);
    const d = deps({ getCode: async () => "0x6080" as Hex, callIsValidSignature });
    const r = await verifyWalletSignature(
      { address: CONTRACT_WALLET, message: MESSAGE, signature: SIG },
      d,
    );
    expect(r).toEqual({ valid: true, path: "erc1271" });
    // The contract is asked about the EIP-191 hash of the exact message.
    expect(callIsValidSignature).toHaveBeenCalledWith(
      CONTRACT_WALLET,
      hashMessage(MESSAGE),
      SIG,
    );
  });

  it("accepts the Socios.com Wallet's hex-string encoding (personal_sign over the literal hex viem sends)", async () => {
    // The wallet signs `hashMessage(stringToHex(message))`, not the decoded
    // message. isValidSignature only returns magic for that hash.
    const hexHash = hashMessage(stringToHex(MESSAGE));
    const callIsValidSignature = vi.fn(async (_addr: Hex, hash: Hex) =>
      (hash === hexHash ? ERC1271_MAGIC_VALUE : "0xffffffff") as Hex,
    );
    const d = deps({ getCode: async () => "0x6080" as Hex, callIsValidSignature });
    const r = await verifyWalletSignature(
      { address: CONTRACT_WALLET, message: MESSAGE, signature: SIG },
      d,
    );
    expect(r).toEqual({ valid: true, path: "erc1271" });
    // Plain encoding tried first, hex encoding second.
    expect(callIsValidSignature).toHaveBeenCalledWith(CONTRACT_WALLET, hashMessage(MESSAGE), SIG);
    expect(callIsValidSignature).toHaveBeenCalledWith(CONTRACT_WALLET, hexHash, SIG);
  });

  it("rejects on a non-magic return value", async () => {
    const d = deps({
      getCode: async () => "0x6080" as Hex,
      callIsValidSignature: async () => "0xffffffff" as Hex,
    });
    const r = await verifyWalletSignature(
      { address: CONTRACT_WALLET, message: MESSAGE, signature: SIG },
      d,
    );
    expect(r).toEqual({ valid: false, path: "erc1271" });
  });

  it("rejects (not throws) when the contract call reverts", async () => {
    const d = deps({
      getCode: async () => "0x6080" as Hex,
      callIsValidSignature: async () => {
        throw new Error("execution reverted");
      },
    });
    const r = await verifyWalletSignature(
      { address: CONTRACT_WALLET, message: MESSAGE, signature: SIG },
      d,
    );
    expect(r).toEqual({ valid: false, path: "erc1271" });
  });

  it("never touches the EOA recovery path for contract wallets", async () => {
    const recoverSigner = vi.fn(async () => CONTRACT_WALLET);
    const d = deps({
      getCode: async () => "0x6080" as Hex,
      callIsValidSignature: async () => ERC1271_MAGIC_VALUE as Hex,
      recoverSigner,
    });
    await verifyWalletSignature(
      { address: CONTRACT_WALLET, message: MESSAGE, signature: SIG },
      d,
    );
    expect(recoverSigner).not.toHaveBeenCalled();
  });
});

describe("verifyWalletSignature — EOA (ecrecover)", () => {
  const account = privateKeyToAccount(("0x" + "11".repeat(32)) as Hex);

  it("accepts a genuine personal_sign signature (offline viem recovery)", async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifyWalletSignature(
      { address: account.address, message: MESSAGE, signature },
      deps({ recoverSigner: recoverSignerViem }),
    );
    expect(r).toEqual({ valid: true, path: "eoa" });
  });

  it("rejects when the signature is over a different message", async () => {
    const signature = await account.signMessage({ message: "something else" });
    const r = await verifyWalletSignature(
      { address: account.address, message: MESSAGE, signature },
      deps({ recoverSigner: recoverSignerViem }),
    );
    expect(r).toEqual({ valid: false, path: "eoa" });
  });

  it("rejects when the recovered signer is a different wallet", async () => {
    const other = privateKeyToAccount(("0x" + "22".repeat(32)) as Hex);
    const signature = await other.signMessage({ message: MESSAGE });
    const r = await verifyWalletSignature(
      { address: account.address, message: MESSAGE, signature },
      deps({ recoverSigner: recoverSignerViem }),
    );
    expect(r).toEqual({ valid: false, path: "eoa" });
  });

  it("accepts an EOA signature made over the hex-string encoding", async () => {
    // Simulates a signer that (like the Socios wallet) signed the hex string.
    const signature = await account.signMessage({ message: stringToHex(MESSAGE) });
    const r = await verifyWalletSignature(
      { address: account.address, message: MESSAGE, signature },
      deps({ recoverSigner: recoverSignerViem }),
    );
    expect(r).toEqual({ valid: true, path: "eoa" });
  });

  it("compares addresses case-insensitively", async () => {
    const d = deps({ recoverSigner: async () => account.address.toUpperCase().replace("0X", "0x") as Hex });
    const r = await verifyWalletSignature(
      { address: account.address.toLowerCase() as Hex, message: MESSAGE, signature: SIG },
      d,
    );
    expect(r).toEqual({ valid: true, path: "eoa" });
  });
});
