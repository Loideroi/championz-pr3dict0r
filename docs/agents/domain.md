# Domain docs: single context

One `CONTEXT.md` (glossary) + `docs/adr/` (decisions) at the repo root.

- Read `CONTEXT.md` and any ADR touching your area **before** starting work.
- Use the glossary vocabulary everywhere: issue titles, code identifiers, test names,
  commit messages (e.g. "decider", "stage floor", "provisional window" — not synonyms).
- ADRs are immutable. To change a decision, write a new ADR that supersedes the old
  one and links back. Never edit a merged ADR's decision.
- ADRs 0001–0011 encode the grilled PRD decisions D1–D11 (PRD §21). If work seems to
  contradict one, flag it explicitly ("contradicts ADR-0006 because …") rather than
  silently overriding.
