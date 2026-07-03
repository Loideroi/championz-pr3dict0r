# ADR-0005 ⚡ — Owner is a single hardware-backed key (D5)

Status: accepted · 2026-07-04 · PRD §10.1, §21-D5 · user decision

## Context

The owner key can force-correct results (behind pause), rotate the oracle, upgrade the
UUPS proxy, and trigger the 180-day emergency withdrawal. The predecessor's audit
(M-01) recommended a multisig; this is a solo-operated fan project where extra signers
would be the same person's devices.

## Decision

Owner = `0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8`, a single hardware-backed key,
never in CI, never hot. No multisig, no timelock. The key setup is not called out in
the T&Cs (the generic smart-contract-risk clause stands). `feeRecipient` defaults to
the same wallet.

## Consequences

Trust rests on structural caps in the contract instead of key ceremony: `freezeStage`
recomputes points on-chain, post-finalization corrections require pause + loud events,
`emergencyWithdraw` is 180-day locked, and the oracle is a separate low-value key.
Compromise of this key is the system's worst failure mode — protect it accordingly;
the security program (issue 16) re-checks these caps explicitly.
