import type { Fixture, MatchResult } from './source.js';

/**
 * Match Insights (slice 15, ADR-0011) — automation-first and LLM-free at
 * runtime: deterministic FACTS extracted from the feed (form, mini-table
 * positions, stage context) rendered through per-locale sentence templates.
 * Numeric slots are identical across locales by construction, which is the
 * parity property the predecessor enforced with merge tooling.
 */

export interface MatchFacts {
  uefaMatchId: string;
  home: string;
  away: string;
  /** last ≤5 results before this match, newest first: 'W' | 'D' | 'L' */
  homeForm: string[];
  awayForm: string[];
  /** mini-table position among the supplied matches' teams; null pre-MD2 or knockout */
  homePos: number | null;
  awayPos: number | null;
  knockout: boolean;
  decider: boolean;
}

export const INSIGHT_LOCALES = ['en', 'es', 'fr', 'it', 'pt-BR', 'tr'] as const;
export type InsightLocale = (typeof INSIGHT_LOCALES)[number];

/** Completed match snapshot used for form/table computation. */
export interface PlayedMatch {
  fixture: Fixture;
  result: MatchResult;
}

const outcomeFor = (teamId: string, m: PlayedMatch): 'W' | 'D' | 'L' => {
  const home = m.fixture.home.uefaTeamId === teamId;
  const [f, a] = home
    ? [m.result.totalA, m.result.totalB]
    : [m.result.totalB, m.result.totalA];
  if (f > a) return 'W';
  if (f < a) return 'L';
  return 'D';
};

export function formFor(teamId: string, played: PlayedMatch[], beforeKickoff: number): string[] {
  return played
    .filter(
      (m) =>
        (m.fixture.home.uefaTeamId === teamId || m.fixture.away.uefaTeamId === teamId) &&
        (m.fixture.kickoffUnix ?? 0) < beforeKickoff,
    )
    .sort((a, b) => (b.fixture.kickoffUnix ?? 0) - (a.fixture.kickoffUnix ?? 0))
    .slice(0, 5)
    .map((m) => outcomeFor(teamId, m));
}

/** League-phase mini table (3/1/0 points) over the played matches. */
export function tablePositions(played: PlayedMatch[]): Map<string, number> {
  const pts = new Map<string, number>();
  for (const m of played.filter((x) => x.fixture.type === 'GROUP_STAGE')) {
    const home = m.fixture.home.uefaTeamId;
    const away = m.fixture.away.uefaTeamId;
    const add = (id: string, p: number) => pts.set(id, (pts.get(id) ?? 0) + p);
    if (m.result.totalA > m.result.totalB) add(home, 3);
    else if (m.result.totalA < m.result.totalB) add(away, 3);
    else {
      add(home, 1);
      add(away, 1);
    }
    pts.set(home, pts.get(home) ?? 0);
    pts.set(away, pts.get(away) ?? 0);
  }
  const ranked = [...pts.entries()].sort((a, b) => b[1] - a[1]);
  return new Map(ranked.map(([id], i) => [id, i + 1]));
}

export function buildFacts(fixture: Fixture, played: PlayedMatch[], decider: boolean): MatchFacts {
  const table = tablePositions(played);
  const knockout = fixture.type !== 'GROUP_STAGE';
  const kickoff = fixture.kickoffUnix ?? Number.MAX_SAFE_INTEGER;
  return {
    uefaMatchId: fixture.uefaMatchId,
    home: fixture.home.name,
    away: fixture.away.name,
    homeForm: formFor(fixture.home.uefaTeamId, played, kickoff),
    awayForm: formFor(fixture.away.uefaTeamId, played, kickoff),
    homePos: knockout ? null : (table.get(fixture.home.uefaTeamId) ?? null),
    awayPos: knockout ? null : (table.get(fixture.away.uefaTeamId) ?? null),
    knockout,
    decider,
  };
}

/* ------------------------------------------------------------------------ */
/* Per-locale templates — slot-filled; numbers identical by construction     */
/* ------------------------------------------------------------------------ */

type T = {
  formLine: (team: string, form: string) => string;
  noForm: (team: string) => string;
  tableLine: (home: string, hp: number, away: string, ap: number) => string;
  knockout: string;
  decider: string;
};

const FORM_WORD: Record<InsightLocale, Record<'W' | 'D' | 'L', string>> = {
  en: { W: 'W', D: 'D', L: 'L' },
  es: { W: 'V', D: 'E', L: 'D' },
  fr: { W: 'V', D: 'N', L: 'D' },
  it: { W: 'V', D: 'N', L: 'P' },
  'pt-BR': { W: 'V', D: 'E', L: 'D' },
  tr: { W: 'G', D: 'B', L: 'M' },
};

const TEMPLATES: Record<InsightLocale, T> = {
  en: {
    formLine: (t, f) => `${t} arrive on a ${f} run`,
    noForm: (t) => `${t} open their campaign`,
    tableLine: (h, hp, a, ap) => `The table says ${h} ${hp}ᵗʰ, ${a} ${ap}ᵗʰ — the pitch will have its own opinion.`,
    knockout: 'Knockout football: the 90-minute score feeds the rubric, the tie decides who breathes.',
    decider: 'A decider — extra time, penalties and the advancing team are all worth calling.',
  },
  es: {
    formLine: (t, f) => `${t} llega con una racha de ${f}`,
    noForm: (t) => `${t} estrena su campaña`,
    tableLine: (h, hp, a, ap) => `La tabla dice ${h} ${hp}º, ${a} ${ap}º — el césped tendrá su propia opinión.`,
    knockout: 'Eliminatoria: el marcador de 90 minutos alimenta la puntuación; la eliminatoria decide quién respira.',
    decider: 'Partido decisivo: prórroga, penaltis y quién avanza — todo puntúa.',
  },
  fr: {
    formLine: (t, f) => `${t} arrive sur une série ${f}`,
    noForm: (t) => `${t} lance sa campagne`,
    tableLine: (h, hp, a, ap) => `Le classement dit ${h} ${hp}ᵉ, ${a} ${ap}ᵉ — la pelouse aura son mot à dire.`,
    knockout: 'Match couperet : le score à 90 minutes nourrit le barème, la confrontation décide qui respire.',
    decider: 'Match décisif — prolongation, tirs au but et qualifié : tout se pronostique.',
  },
  it: {
    formLine: (t, f) => `${t} arriva con una striscia di ${f}`,
    noForm: (t) => `${t} inaugura il suo cammino`,
    tableLine: (h, hp, a, ap) => `La classifica dice ${h} ${hp}º, ${a} ${ap}º — il campo avrà la sua opinione.`,
    knockout: 'Gara a eliminazione: il punteggio dei 90 minuti alimenta il punteggio, il confronto decide chi respira.',
    decider: 'Gara decisiva: supplementari, rigori e chi passa — si pronostica tutto.',
  },
  'pt-BR': {
    formLine: (t, f) => `${t} chega numa sequência de ${f}`,
    noForm: (t) => `${t} estreia na campanha`,
    tableLine: (h, hp, a, ap) => `A tabela diz ${h} ${hp}º, ${a} ${ap}º — o gramado terá opinião própria.`,
    knockout: 'Mata-mata: o placar dos 90 minutos alimenta a pontuação; o confronto decide quem respira.',
    decider: 'Jogo decisivo: prorrogação, pênaltis e quem avança — tudo vale ponto.',
  },
  tr: {
    formLine: (t, f) => `${t}, ${f} serisiyle geliyor`,
    noForm: (t) => `${t} kampanyasına başlıyor`,
    tableLine: (h, hp, a, ap) => `Puan durumu ${h} ${hp}., ${a} ${ap}. diyor — sahanın kendi fikri olacak.`,
    knockout: 'Eleme maçı: 90 dakikalık skor puanlamayı besler; turu kimin geçtiğini eşleşme belirler.',
    decider: 'Karar maçı — uzatmalar, penaltılar ve tur atlayan takım: hepsi tahmin edilir.',
  },
};

export function renderInsight(facts: MatchFacts, locale: InsightLocale): string {
  const t = TEMPLATES[locale];
  const fmtForm = (form: string[]) =>
    form.map((x) => FORM_WORD[locale][x as 'W' | 'D' | 'L']).join('-');
  const homePart =
    facts.homeForm.length > 0 ? t.formLine(facts.home, fmtForm(facts.homeForm)) : t.noForm(facts.home);
  const awayPart =
    facts.awayForm.length > 0 ? t.formLine(facts.away, fmtForm(facts.awayForm)) : t.noForm(facts.away);
  const parts: string[] = [`${homePart}; ${awayPart}.`];
  if (facts.homePos !== null && facts.awayPos !== null) {
    parts.push(t.tableLine(facts.home, facts.homePos, facts.away, facts.awayPos));
  }
  if (facts.decider) parts.push(t.decider);
  else if (facts.knockout) parts.push(t.knockout);
  return parts.join(' ');
}

export function renderAllLocales(facts: MatchFacts): Record<InsightLocale, string> {
  return Object.fromEntries(
    INSIGHT_LOCALES.map((l) => [l, renderInsight(facts, l)]),
  ) as Record<InsightLocale, string>;
}
