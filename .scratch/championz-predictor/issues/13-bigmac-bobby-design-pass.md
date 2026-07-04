# 13 — BigMac Bobby design pass

Status: ready-for-human
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

## Comments

**2026-07-04 — applied across all routes.**
- **AA contrast measured, not eyeballed**: computed WCAG ratios for every palette
  token on night/night-2. All pass except `--muted-2` (#5e6a92 → 3.71:1) — lightened
  to **#727eab** (4.96:1 / 4.74:1), same hue family; every other token was already
  compliant (ink 17.3, muted 6.9, glow-2 7.6, star 12.5).
- **Hex audit clean**: `grep '\[#' app components` → 0; the one offender
  (`from-[#cfe0ff]` hero gradient) became the `--glow-soft` token. Design-system
  colors live only in `app/globals.css`.
- **Chrome**: `Starfield` canvas (mock-faithful twinkle; `prefers-reduced-motion`
  draws one static frame, plus the global CSS animation kill-switch), sticky
  `SiteNav` (brand mark, aria-current links, wallet pill with live dot), `StatStrip`
  on home (predictors / prize pools / matches, live from chain, accent top-bars).
- Verified serving on all routes: nav + canvas + footer credit on /, /enter, /play,
  /standings; stat strip + tokenized gradient on home. Steppers/pills/toggles were
  already real controls with aria-pressed (slices 02/07/08).
- **Remaining (human):** a taste pass in a real browser — spacing/glow judgment is
  yours; everything mechanical is verified.
