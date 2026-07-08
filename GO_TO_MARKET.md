# GO TO MARKET — ₵h@mpi0nz Pr3dict0r

**Owner:** Mark (CPO). **Live product:** https://pr3dict0r.com (Chiliz mainnet).
**Season timeline:** league draw **27 Aug 2026** → sales close / MD1 **8 Sep 2026** →
knockout sales close **17 Feb 2027** → final in Madrid **May 2027**.

Status legend: ✅ done · 🔄 in flight · 🔲 open (owner) · 🤖 open (agent can do)

---

## 1. Trust & reputation (defence — mostly done)

| Activity | Status | Notes |
|---|---|---|
| OG/Twitter cards, robots.txt, sitemap.xml, security.txt, rich manifest | ✅ | PR #32 |
| Google Search Console registered + sitemap submitted | ✅ | No security issues flagged (checked 2026-07-08) |
| Reown/WalletConnect domain allowlist (pr3dict0r.com + www) | ✅ | Verify v2 attests from the allowlist — no well-known file needed |
| Rabby dApp whitelist request | 🔄 | [RabbyHub/Rabby#3881](https://github.com/RabbyHub/Rabby/issues/3881) — watch for follow-up questions |
| ScamSniffer pre-emptive whitelist | 🔄 | [scamsniffer/scam-database#667](https://github.com/scamsniffer/scam-database/issues/667) |
| MetaMask eth-phishing-detect | ✅ | Checked: not listed. Only act if ever flagged |
| DeBank dApp submission | 🔲 | User believes submitted — confirm the listing appears at debank.com (API blocks scripted checks) |
| Blockaid / ChainPatrol registration | 🔲 | Forms need owner account: https://report.blockaid.io + https://app.chainpatrol.io/report — register official asset so lookalikes can be taken down |
| Bing Webmaster Tools | 🔲 | Same sitemap, 5 min — covers Edge/SmartScreen reputation |
| Contract + oracle shown on-site w/ explorer links | ✅ | Footer + homepage TrustBox |
| Inbound link from chiliz.com / socios.com | 🔲 | **Highest-value single reputation signal available** — one ecosystem-page listing or tweet from the official accounts |

## 2. Owned channels (build the megaphone)

| Activity | Status | Notes |
|---|---|---|
| Telegram results channel @championz_pr3dict0r | ✅ | Bot admin'd. ⚠ Re-add `TELEGRAM_CHANNEL_ID` Actions var post-draw (sentinel reminds) |
| Telegram community group | 🔲 | Create → add bot admin → set `TELEGRAM_GROUP_ID` var. Feedback + banter home |
| X/Twitter handle (@pr3dict0r / @championz_pr3d) | 🔲 | Claim NOW even if quiet until August — squatting risk on a live product name |
| Farcaster account | 🔲 | Crypto-native audience; low effort, high fit. Same handle |
| Discord | 🔲 | Optional — only if the Telegram group outgrows itself; don't split community early |
| Link socials in the site footer | 🤖 | Once handles exist — one small PR |
| PWA install banner (Android prompt / iOS walkthrough) | ✅ | Socios in-app browser detected → "open in Safari" |

## 3. Distribution & listings

| Activity | Status | Notes |
|---|---|---|
| Cross-promo banner on predictor.chilitize.com (4 pages, 6 locales, UTM-tagged) | ✅ | First live funnel |
| DappRadar listing | 🔲 | https://dappradar.com/dashboard — free listing, Chiliz Chain category exists; needs owner account |
| Chiliz ecosystem page listing | 🔲 | CPO-internal ask — chiliz.com ecosystem/dApps directory |
| Socios.com app placement | 🔲 | CPO-internal — even a Fan Rewards mention drives the exact target audience |
| WalletConnect Explorer / Reown dApp catalogue | 🔲 | Reown dashboard → project → Explorer listing (optional, free) |
| DeBank dApp page (also feeds Rabby) | 🔄 | See §1 |

## 4. Content & campaigns (the season arc)

| Activity | Status | Notes |
|---|---|---|
| Launch thread/post: "the game continues" (WC predictor → UCL) | 🔲 | Needs the X handle first. Anchor: verified contract, real CHZ, zero admin — oracle does the work |
| **Draw-day content (27 Aug)** | 🔲 | The natural viral moment: fixtures land on-chain the same day — "144 matches now on the slate" |
| **Deadline campaign (1–8 Sep)** | 🔲 | Early-bird pass closes at MD1 kickoff — countdown content; the floor-risk sentinel doubles as the internal trigger |
| Weekly leaderboard posts after each matchday | 🔲 | The results channel automates raw results; leaderboard screenshots + "flag flies" narrative are the shareable layer |
| Knockout re-launch (Jan–Feb 2027) | 🔲 | Second acquisition window: 550 CHZ pass, fresh leaderboard — "latecomers welcome" |
| AMA in Chiliz/fan-token communities (Reddit r/chiliz, TG groups) | 🔲 | Founder-led; the CPO angle is the story |
| KOL seeding (fan-token / football-crypto X accounts) | 🔲 | A handful of authentic voices > paid blast; give them a pass? (⚠ compliance: geo-fence excludes 14 jurisdictions) |

## 5. Product growth loops (build when traction justifies)

| Activity | Status | Notes |
|---|---|---|
| UTM discipline on every inbound link | ✅/🔲 | Banner tagged; keep the habit for socials (`?utm_source=x` etc.) |
| Referral mechanic ("invite a rival" link with attribution) | 🔲 | Simplest loop for a leaderboard game; needs design |
| Share-my-prediction / share-my-rank cards (OG images per wallet) | 🔲 | Big lever for a prediction game; medium build |
| Telegram account linking (already built) surfaced post-entry | ✅ | Nudge users into the channel at the moment of maximum excitement |
| Draw-day email/TG blast to World Cup predictor alumni | 🔲 | The warmest audience that exists; check what contact consent the WC predictor captured |

## 6. Measurement

| Activity | Status | Notes |
|---|---|---|
| North-star: paid entrants (league pass count on-chain) | ✅ | Free from the chain; sentinel already watches the ≥20 floor |
| Funnel: banner clicks → visits → wallet connects → entries | 🔲 | Vercel Analytics (free tier) or Plausible; AppKit analytics currently off — flip `analytics: true` in providers.tsx for connect-rate data (🤖) |
| Weekly GTM review vs this file | 🔲 | Keep statuses current; treat this doc as the single GTM source of truth |

---

## Sequencing (what matters this month)

1. **Claim the X handle + create the TG group** (squatting risk; everything in §4 needs them).
2. **Chiliz/socios ecosystem link** (one internal ask, biggest reputation + traffic win).
3. DappRadar + remaining §1 registrations (one sitting).
4. Prepare draw-day content for 27 Aug — the fixture drop is the launch moment; MD1 (8 Sep) is the deadline that converts.

*Research context: 2026 web3 GTM playbooks converge on narrative-first + community-as-distribution ([Surgence](https://surgence.io/blog/web3-go-to-market), [Forbes](https://www.forbes.com/councils/forbesbusinesscouncil/2026/02/23/10-go-to-market-strategies-for-web3-business-leaders/), [Coinbound](https://coinbound.io/web3-marketing-tips-for-startups-to-launch-successfully/)). Ours: "the World Cup game you loved, now for the Champions League — real CHZ, verified contract, zero admin." Narrow early audience: existing WC-predictor players + Chiliz fan-token holders.*
