# 13 — BigMac Bobby design pass

Status: ready-for-agent
PRD: ../../PRD.md §14

## What to build

Apply the "European nights" visual identity across every existing surface. Semantic
CSS-variable design tokens carry the palette (deep navy #060A1A, glow blue #2E6BFF,
CHZ pink #FF1257, star gold #F6C76A) with Archivo display / Inter body / Space Mono
data type; components consume tokens only — no hardcoded hexes. Signature elements
from the style-guide mock: the ambient starfield, glowing scoreboard steppers with
▲▼ controls, pill badges, stat strips with accent top-bars, generous uppercase display
type. The footer credit "Design inspired by BigMac Bobby" appears on every page.
Interactive elements are real controls (buttons, aria-pressed toggles);
prefers-reduced-motion disables the starfield and transitions; glow-on-navy
combinations pass AA contrast. Note the Tailwind v4 hazard: the PostCSS config and the
@source-bearing global stylesheet are both load-bearing — neither may be deleted.

## Acceptance criteria

- [ ] Every page renders in the token palette; a grep for design-system hexes in components returns nothing
- [ ] Starfield, steppers, pills and stat strips match the style-guide mock's language
- [ ] Footer credit present on every route
- [ ] prefers-reduced-motion verified: no animation, no starfield drift
- [ ] AA contrast checks pass for all text-on-background token pairs
- [ ] Toggles expose aria-pressed; no clickable divs

## Blocked by

- 08-prediction-ux.md
