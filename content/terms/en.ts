import type { TermsDocument } from "./types";

/** Canon tie-break joke, English. Adapted (never translated) in the other five. */
export const TIE_BREAK_JOKE =
  "Still level after all that? Lowest wallet address wins — the only trophy in football decided at the moment of birth. Train all you like; 0x00 was simply born different.";

const en: TermsDocument = {
  locale: "en",
  title: "Terms & Conditions",
  updated: "2026-07-05",
  sections: [
    {
      id: "preamble",
      heading: "1. Read this (yes, actually)",
      body: [
        "These Terms & Conditions govern ₵h@mpi0nz Pr3dict0r, an on-chain football prediction competition covering the 2026/27 UEFA Champions League season, operated on the Chiliz Chain. By purchasing an entry you accept every clause below, including the ones you were planning to skim.",
        "These Terms were written to be read, which is why they are funny. The jokes are load-bearing: each one marks a rule that somebody, somewhere, was going to email us about.",
      ],
      joke: "Every joke in this document was reviewed for legal effect. All of the rules survived review; several jokes did not. Pour one out for Section 7's original punchline.",
    },
    {
      id: "skill-game",
      heading: "2. A game of skill, not a bookmaker",
      body: [
        "₵h@mpi0nz Pr3dict0r is a skill-based prediction competition. There are no odds, no bookmaker and no house edge on outcomes: every prize pool is funded exclusively by entry stakes, and the operator's only revenue is the flat entry fee stated in Section 4.",
        "We never take a position against you. We genuinely do not care who wins any match — which makes us the only party in football of whom that is true.",
      ],
      joke: "If you're looking for guaranteed profits, this is still not for you — and now you'd also have to out-predict everyone who read this sentence and stayed anyway.",
    },
    {
      id: "entry-tiers",
      heading: "3. Two passes, boarding now",
      body: [
        "The Full Season pass competes in Stage 1 (League Phase, Matchdays 1–8) and Stage 2 (Knockout). The Knockout pass competes in Stage 2 only. One entry per wallet per stage; a Full Season wallet is automatically entered in both stages with no second transaction in February.",
        "Think of it as boarding classes: Full Season boards first and flies both legs of the journey; Knockout boards at the knockout gate. There is no legroom difference, only fewer matchdays. Neither pass includes a meal.",
      ],
      joke: "Upgrades at the gate are not available. The gate is a smart contract; it has heard every excuse and accepted none.",
    },
    {
      id: "pricing-and-fees",
      heading: "4. Prices are exact. Alarmingly exact.",
      body: [
        "A Full Season entry costs exactly 1,100 CHZ: 500 CHZ to the League Pool, 500 CHZ to the Knockout Pool, and a flat 100 CHZ operator fee. A Knockout entry costs exactly 550 CHZ: 500 CHZ to the Knockout Pool and a flat 50 CHZ operator fee.",
        "The contract enforces the exact amount, and fees are held in escrow by the contract and forwarded to the fee recipient at stage lock. Until then, even our own fee is locked away from us — we wrote a door we also cannot open.",
      ],
      joke: "Send 1,099 CHZ and the contract rejects it. Send 1,101 CHZ and the contract rejects that too. It is not haggling; it is arithmetic with a door policy.",
    },
    {
      id: "entry-windows",
      heading: "5. Windows close on time. The referee doesn't wait.",
      body: [
        "Full Season sales hard-close at the first Matchday 1 kickoff. Not 'around kickoff' — the whistle is the closing bell, and no whistle in history has ever waited for a pending transaction.",
        "Knockout sales open at that very second — the shop is never closed — and stay open until 60 minutes before the last play-off first-leg kickoff.",
        "Join late in the knockout window and any match that has already locked scores 0 points for you. The purchase screen lists exactly which matches you have missed before you can pay: you buy with your eyes open, which is the only refund-proof way to buy anything.",
      ],
      joke: "'It already started, let me in!' works for Stage 2 and only Stage 2. For Stage 1 the correct phrase is 'see you in February'.",
    },
    {
      id: "refunds",
      heading: "6. Refunds (a short section)",
      body: [
        "Entries are final and non-refundable from the moment of purchase. 'From purchase' means from purchase: a Knockout pass bought in September is locked in September, not in February.",
        "There is exactly one exception. If a stage locks with fewer than 20 entrants, that stage is void and every entrant in it is refunded that stage's entry in full, flat fee included. Nineteen people is not a competition; it is a group chat with escrow.",
      ],
      joke: "This is the shortest section in the document because every sentence we removed was a longer way of saying 'no'.",
    },
    {
      id: "predictions",
      heading: "7. Edit your mind. Bring gas money.",
      body: [
        "Predictions for each match may be submitted and edited freely until 60 minutes before its kickoff, at which point they lock. Editing means resubmitting on-chain: the new prediction overwrites the old, and you pay network gas each time.",
        "A match with no prediction scores 0 points. The contract does not guess on your behalf; it has seen what happens when people guess.",
      ],
      joke: "Changing your mind is free. Having changed your mind costs gas. Philosophers have built entire careers on less.",
    },
    {
      id: "scoring",
      heading: "8. Scoring: 5/3/1 plus the decider bonuses",
      body: [
        "Each match awards at most one scoreline prize: 5 points for the exact score, 3 points for the correct outcome with the correct goal difference, 1 point for the correct outcome alone. That is the whole 5/3/1 of it.",
        "Knockout deciders — the second leg of a tie, and the final — additionally carry three +1 bonuses: extra time played, penalties taken, and correctly naming the team that advances (or lifts the trophy). First legs score base points only; a first leg cannot go to extra time, no matter how strongly it felt like it did.",
      ],
      joke: "5/3/1 is not a formation. As a formation it would be a war crime against full-backs.",
    },
    {
      id: "ninety-minute-rule",
      heading: "9. The 90-minute rule (pre-emptive support answer)",
      body: [
        "All scoreline points are computed on the score after 90 minutes — the regular-time score — even when every headline on Earth reports the after-extra-time total as 'the result'. Extra time and penalties count exclusively through the decider bonuses in Section 8.",
      ],
      joke: "Yes, it went to extra time. No, we don't care. Section 9 has been waiting for your email since the 91st minute, and it has never once lost the argument.",
    },
    {
      id: "results-oracle",
      heading: "10. Results are set by a robot",
      body: [
        "Match results are pushed on-chain by an automated oracle that reads UEFA's own match data. The robot does not take bribes; it doesn't even take weekends. It has no favourite team, no cousin with a betting slip, and no plans on a Tuesday night other than this.",
        "Every result is provisional for 24 hours, during which it can be corrected — including when UEFA amends its own data, which happens more often than UEFA would like you to know. Leaderboards move immediately, marked with a provisional badge, and the result finalises automatically when the window closes.",
      ],
      joke: "You cannot argue with the robot. You can email a human, who will check what the robot read, confirm the robot read it correctly, and send you a genuinely warm link to Section 11.",
    },
    {
      id: "mirror-uefa",
      heading: "11. We mirror UEFA verbatim, forfeits included",
      body: [
        "Whatever UEFA records as the regular-time result is the result — including forfeits, sanctions, withdrawals and awarded results. If a match is abandoned and replayed, whatever UEFA ultimately records for that fixture is what counts.",
        "If UEFA awards it 3-0 at a green table, that's the score. Take it up with Nyon. Bring a coat: the town runs cold, and the appeals desk runs colder.",
        "A match is voided only if we created a fixture that should never have existed. Our mistakes qualify; UEFA's decisions never do.",
      ],
      joke: "Predicted 3-0 on a match that got forfeited 3-0? Congratulations on your 5 points. The universe occasionally takes your side, and per this section, we mirror the universe too.",
    },
    {
      id: "tie-breaks",
      heading: "12. Tie-breaks, in descending order of dignity",
      body: [
        "Leaderboard ties are broken in strict order: 1) total points; 2) most exact scores; 3) earliest entry timestamp; 4) lowest wallet address.",
        "Three of these reward skill or commitment. The fourth rewards being born lucky — which, as any striker will happily tell you, is also a skill.",
      ],
      joke: TIE_BREAK_JOKE,
    },
    {
      id: "prizes",
      heading: "13. Prizes: the top-20 split",
      body: [
        "Each stage pays its own pool to that stage's top 20: 25% to 1st, 15% to 2nd, 10% to 3rd, 30%÷7 shared equally by places 4–10, and 20%÷10 shared equally by places 11–20. Integer rounding dust goes to rank 1 — being first has perks, and some of them are microscopic.",
        "Stage 1 pays out as soon as Matchday 8's last result clears its 24-hour provisional window; Stage 2 pays after the final. No points and no funds ever cross between the two pools.",
        "The Ultimate ₵h@mpi0n — best combined season score — receives an on-chain trophy NFT with a monetary value of exactly zero, plus a profile crown and a permanent hall-of-fame page. The zero is deliberate, structural and eternal: the trophy carries glory, not funds.",
      ],
      joke: "The trophy NFT is worth zero by design — the one time in crypto history that the market has fully agreed with the whitepaper.",
    },
    {
      id: "public-chain",
      heading: "14. The blockchain is public. So are you.",
      body: [
        "All predictions are stored on a public blockchain and are readable by anyone from the moment you submit them: your rivals, your group chat, your ex, and eventually an archaeologist with a block explorer.",
        "Lockout (Section 7) is your protection window: once a match locks, copying you becomes impossible. Before it locks, being copied is simply the price of playing in public.",
      ],
      joke: "There is no incognito mode for the blockchain. There is barely one for your browser.",
    },
    {
      id: "smart-contract-risk",
      heading: "15. Software risk (the serious one)",
      body: [
        "This competition runs on smart contracts. Smart contracts are software; software has bugs; blockchains make bugs permanent and public. We test, audit and adversarially review the contracts — and we still cannot promise perfection, because nobody honestly can.",
        "You participate at your own risk, up to and including total loss of your stake through contract failure, chain failure or your own key management. Never stake what you cannot afford to lose.",
      ],
      joke: "This is the one section our lawyer read twice and laughed at zero times. Please match her energy while reading it.",
    },
    {
      id: "eligibility",
      heading: "16. Eligibility: your homework, our door policy",
      body: [
        "By entering, you self-certify that you are of legal age and that taking part in a paid skill-based prediction competition is lawful where you live. That homework is yours: we cannot do it for 195 countries, and neither can this paragraph.",
        "Access is blocked from the following 14 jurisdictions: CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN, QA, SG. Visitors from these receive HTTP 451 — the only status code named after a novel about burning books, which remains the most literary thing a firewall has ever done.",
      ],
      joke: "Circumventing the block does not make you eligible. It makes you ineligible with extra steps.",
    },
    {
      id: "uefa-affiliation",
      heading: "17. UEFA does not know us (mandatory clause)",
      body: [
        "₵h@mpi0nz Pr3dict0r is not affiliated with, endorsed by, or in any way associated with UEFA or the UEFA Champions League. Club names, badges and crests are the property of their respective owners and appear solely to identify the matches you are predicting.",
      ],
      joke: "This is the one section where we are legally required to not be funny — and frankly, UEFA would prefer the other eighteen weren't either.",
    },
    {
      id: "final-authority",
      heading: "18. Where words and code disagree, code wins",
      body: [
        "These Terms describe the deployed smart contract in six human languages. If any sentence in any of them disagrees with what the deployed contract actually does, the deployed contract is the final authority.",
      ],
      joke: "These Terms are the film adaptation; the bytecode is the book. And you already know what everyone always says about the book.",
    },
    {
      id: "credits",
      heading: "19. Credits",
      body: [
        "Visual design: BigMac Bobby, author of the 'European nights' style guide. This credit is contractually mandatory and appears on every page, including this one.",
      ],
      joke: "BigMac Bobby agreed to be paid in exposure. This clause is the exposure. The account is hereby settled in full.",
    },
  ],
};

export default en;
