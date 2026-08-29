import type { Fixture, MatchResult } from './source.js';
import { verdictFor, type PrevRun, type TeamStrength, type Verdict } from './strength.js';

/**
 * Match Insights (slice 15, ADR-0011) — automation-first and LLM-free at
 * runtime: deterministic FACTS extracted from the feed (form, mini-table
 * positions, stage context, published club coefficients) rendered through
 * per-locale sentence templates. Numeric slots are identical across locales by
 * construction, which is the parity property the predecessor enforced with
 * merge tooling.
 *
 * Form and the mini-table only exist once the season has produced results, so
 * on matchday 1 they say nothing — every fixture rendered the same sentence.
 * The club coefficient and last season's run fill exactly that gap: published
 * numbers that already say which side is stronger before a ball is kicked.
 * See strength.ts for where they come from and how the call is derived.
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
  /** League-phase matchday (1..8), null for knockout */
  matchday: number | null;
  /**
   * The team's previous fixture in the schedule (opponent + venue) — known
   * from the draw, so matchday 2+ has real context even before any result
   * exists; the form line replaces it once results come in.
   */
  homePrev: PrevFixture | null;
  awayPrev: PrevFixture | null;
  /** Published strength (coefficient + last season); null when unavailable. */
  homeStrength: TeamStrength | null;
  awayStrength: TeamStrength | null;
  /** Who the coefficients favour, home ground included. Null without strength. */
  verdict: Verdict | null;
}

export interface PrevFixture {
  opponent: string;
  /** the team played that previous fixture at home */
  home: boolean;
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

/** The team's latest scheduled fixture before `beforeKickoff`, from the full schedule. */
export function previousFixture(teamId: string, schedule: Fixture[], beforeKickoff: number): PrevFixture | null {
  const prev = schedule
    .filter(
      (f) =>
        (f.home.uefaTeamId === teamId || f.away.uefaTeamId === teamId) &&
        f.kickoffUnix !== null &&
        f.kickoffUnix < beforeKickoff,
    )
    .sort((a, b) => (b.kickoffUnix ?? 0) - (a.kickoffUnix ?? 0))[0];
  if (!prev) return null;
  const home = prev.home.uefaTeamId === teamId;
  return { opponent: home ? prev.away.name : prev.home.name, home };
}

export function buildFacts(
  fixture: Fixture,
  played: PlayedMatch[],
  decider: boolean,
  schedule: Fixture[] = [],
  strength: Map<string, TeamStrength> | null = null,
): MatchFacts {
  const table = tablePositions(played);
  const knockout = fixture.type !== 'GROUP_STAGE';
  const kickoff = fixture.kickoffUnix ?? Number.MAX_SAFE_INTEGER;
  const homeStrength = strength?.get(fixture.home.uefaTeamId) ?? null;
  const awayStrength = strength?.get(fixture.away.uefaTeamId) ?? null;
  return {
    homeStrength,
    awayStrength,
    verdict: homeStrength && awayStrength ? verdictFor(homeStrength, awayStrength) : null,
    uefaMatchId: fixture.uefaMatchId,
    home: fixture.home.name,
    away: fixture.away.name,
    homeForm: formFor(fixture.home.uefaTeamId, played, kickoff),
    awayForm: formFor(fixture.away.uefaTeamId, played, kickoff),
    homePos: knockout ? null : (table.get(fixture.home.uefaTeamId) ?? null),
    awayPos: knockout ? null : (table.get(fixture.away.uefaTeamId) ?? null),
    knockout,
    decider,
    matchday: knockout ? null : fixture.matchday,
    homePrev: previousFixture(fixture.home.uefaTeamId, schedule, kickoff),
    awayPrev: previousFixture(fixture.away.uefaTeamId, schedule, kickoff),
  };
}


/* ------------------------------------------------------------------------ */
/* Per-locale templates — slot-filled; numbers identical by construction     */
/* ------------------------------------------------------------------------ */

type RunLabels = Record<Exclude<PrevRun, 'LEAGUE_PHASE'>, string> & {
  /** Bottom-twelve finishers: the position is the whole story, so it's a slot. */
  LEAGUE_PHASE: (position: string) => string;
};

type T = {
  formLine: (team: string, form: string) => string;
  noForm: (team: string) => string;
  /** Both sides without any form yet — matchday 1 reads as one sentence, not two stubs */
  opening: (home: string, away: string) => string;
  /** No form yet but a previous fixture on the schedule (matchday 2+ before results land) */
  prevLine: (team: string, opponent: string, home: boolean) => string;
  tableLine: (home: string, hp: string, away: string, ap: string) => string;
  knockout: string;
  decider: string;
  /** 1 → "1st" / "1er" / "1." — locale-correct, and used by every position slot */
  ordinal: (n: number) => string;
  /** A coefficient position, or the honest absence of one */
  rank: (position: number | null) => string;
  /** "UEFA coefficients: A No. 2, B No. 5 — <call>." */
  callLine: (home: string, homeRank: string, away: string, awayRank: string, call: string) => string;
  callClear: (team: string) => string;
  callFavourite: (team: string) => string;
  callEdge: (team: string) => string;
  /** The coefficients favour the other side; home ground is what flips it */
  callEdgeHome: (team: string) => string;
  callLevel: string;
  lastSeasonLine: (home: string, homeRun: string, away: string, awayRun: string) => string;
  /** Neither club was in last season's competition — one clause beats two */
  lastSeasonNeither: (home: string, away: string) => string;
  runs: RunLabels;
};

const FORM_WORD: Record<InsightLocale, Record<'W' | 'D' | 'L', string>> = {
  en: { W: 'W', D: 'D', L: 'L' },
  es: { W: 'V', D: 'E', L: 'D' },
  fr: { W: 'V', D: 'N', L: 'D' },
  it: { W: 'V', D: 'N', L: 'P' },
  'pt-BR': { W: 'V', D: 'E', L: 'D' },
  tr: { W: 'G', D: 'B', L: 'M' },
};

/** English ordinals, teens included — "11th", not "11st". */
const enOrdinal = (n: number): string => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

const TEMPLATES: Record<InsightLocale, T> = {
  en: {
    formLine: (t, f) => `${t} arrive on a ${f} run`,
    noForm: (t) => `${t} open their campaign`,
    opening: (h, a) => `Opening night: ${h} and ${a} both start their campaign here — no form to read, only the pitch.`,
    prevLine: (t, o, h) => `${t} after ${h ? 'hosting' : 'visiting'} ${o}`,
    tableLine: (h, hp, a, ap) => `The table says ${h} ${hp}, ${a} ${ap} — the pitch will have its own opinion.`,
    knockout: 'Knockout football: the 90-minute score feeds the rubric, the tie decides who breathes.',
    decider: 'A decider — extra time, penalties and the advancing team are all worth calling.',
    ordinal: enOrdinal,
    rank: (p) => (p === null ? 'unranked' : `No. ${p}`),
    callLine: (h, hr, a, ar, call) => `UEFA coefficients: ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} are clear favourites`,
    callFavourite: (t) => `${t} start favourites`,
    callEdge: (t) => `${t} edge it`,
    callEdgeHome: (t) => `${t} edge it at home`,
    callLevel: 'too close to call',
    lastSeasonLine: (h, hr, a, ar) => `Last season: ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Neither ${h} nor ${a} played in last season's competition.`,
    runs: {
      WINNER: 'champions',
      FINALIST: 'runners-up',
      SEMI_FINAL: 'semi-finalists',
      QUARTER_FINAL: 'quarter-finalists',
      ROUND_OF_16: 'out in the last 16',
      PLAY_OFF: 'out in the play-off',
      LEAGUE_PHASE: (p) => `${p} in the league phase`,
      ABSENT: 'not in the competition',
    },
  },
  es: {
    formLine: (t, f) => `${t} llega con una racha de ${f}`,
    noForm: (t) => `${t} estrena su campaña`,
    opening: (h, a) => `Noche de estreno: ${h} y ${a} arrancan aquí su campaña — sin racha que leer, solo el césped.`,
    prevLine: (t, o, h) => `${t} tras ${h ? 'recibir a' : 'visitar a'} ${o}`,
    tableLine: (h, hp, a, ap) => `La tabla dice ${h} ${hp}, ${a} ${ap} — el césped tendrá su propia opinión.`,
    knockout: 'Eliminatoria: el marcador de 90 minutos alimenta la puntuación; la eliminatoria decide quién respira.',
    decider: 'Partido decisivo: prórroga, penaltis y quién avanza — todo puntúa.',
    ordinal: (n) => `${n}º`,
    rank: (p) => (p === null ? 'sin clasificación' : `n.º ${p}`),
    callLine: (h, hr, a, ar, call) => `Coeficientes UEFA: ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} es claro favorito`,
    callFavourite: (t) => `${t} parte como favorito`,
    callEdge: (t) => `${t} tiene una ligera ventaja`,
    callEdgeHome: (t) => `${t} se impone por jugar en casa`,
    callLevel: 'demasiado igualado para decidirse',
    lastSeasonLine: (h, hr, a, ar) => `La temporada pasada: ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Ni ${h} ni ${a} jugaron la competición la temporada pasada.`,
    runs: {
      WINNER: 'campeón',
      FINALIST: 'subcampeón',
      SEMI_FINAL: 'semifinalista',
      QUARTER_FINAL: 'cuartos de final',
      ROUND_OF_16: 'eliminado en octavos',
      PLAY_OFF: 'eliminado en el play-off',
      LEAGUE_PHASE: (p) => `${p} en la fase liga`,
      ABSENT: 'ausente',
    },
  },
  fr: {
    formLine: (t, f) => `${t} arrive sur une série ${f}`,
    noForm: (t) => `${t} lance sa campagne`,
    opening: (h, a) => `Soir de première : ${h} et ${a} lancent ici leur campagne — aucune série à lire, seulement la pelouse.`,
    prevLine: (t, o, h) => `${t} après ${h ? 'avoir reçu' : 'un déplacement chez'} ${o}`,
    tableLine: (h, hp, a, ap) => `Le classement dit ${h} ${hp}, ${a} ${ap} — la pelouse aura son mot à dire.`,
    knockout: 'Match couperet : le score à 90 minutes nourrit le barème, la confrontation décide qui respire.',
    decider: 'Match décisif — prolongation, tirs au but et qualifié : tout se pronostique.',
    ordinal: (n) => (n === 1 ? '1er' : `${n}e`),
    rank: (p) => (p === null ? 'non classé' : `n° ${p}`),
    callLine: (h, hr, a, ar, call) => `Coefficients UEFA : ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} est nettement favori`,
    callFavourite: (t) => `${t} part favori`,
    callEdge: (t) => `${t} tient un léger avantage`,
    callEdgeHome: (t) => `${t} prend l’avantage à domicile`,
    callLevel: 'trop serré pour trancher',
    lastSeasonLine: (h, hr, a, ar) => `La saison dernière : ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Ni ${h} ni ${a} n’a disputé la compétition la saison dernière.`,
    runs: {
      WINNER: 'vainqueur',
      FINALIST: 'finaliste',
      SEMI_FINAL: 'demi-finaliste',
      QUARTER_FINAL: 'quart de finaliste',
      ROUND_OF_16: 'sorti en huitièmes',
      PLAY_OFF: 'sorti au barrage',
      LEAGUE_PHASE: (p) => `${p} de la phase de ligue`,
      ABSENT: 'absent',
    },
  },
  it: {
    formLine: (t, f) => `${t} arriva con una striscia di ${f}`,
    noForm: (t) => `${t} inaugura il suo cammino`,
    opening: (h, a) => `Serata d'esordio: ${h} e ${a} iniziano qui il loro cammino — nessuna striscia da leggere, solo il campo.`,
    prevLine: (t, o, h) => `${t} dopo ${h ? 'aver ospitato' : 'la trasferta contro'} ${o}`,
    tableLine: (h, hp, a, ap) => `La classifica dice ${h} ${hp}, ${a} ${ap} — il campo avrà la sua opinione.`,
    knockout: 'Gara a eliminazione: il punteggio dei 90 minuti alimenta il punteggio, il confronto decide chi respira.',
    decider: 'Gara decisiva: supplementari, rigori e chi passa — si pronostica tutto.',
    ordinal: (n) => `${n}º`,
    rank: (p) => (p === null ? 'non classificata' : `n. ${p}`),
    callLine: (h, hr, a, ar, call) => `Coefficienti UEFA: ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} è nettamente favorita`,
    callFavourite: (t) => `${t} parte favorita`,
    callEdge: (t) => `${t} è in leggero vantaggio`,
    callEdgeHome: (t) => `${t} passa avanti grazie al fattore campo`,
    callLevel: 'troppo equilibrata per sbilanciarsi',
    lastSeasonLine: (h, hr, a, ar) => `La scorsa stagione: ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Né ${h} né ${a} hanno giocato la competizione la scorsa stagione.`,
    runs: {
      WINNER: 'campione',
      FINALIST: 'finalista',
      SEMI_FINAL: 'semifinalista',
      QUARTER_FINAL: 'quarti di finale',
      ROUND_OF_16: 'fuori agli ottavi',
      PLAY_OFF: 'fuori ai play-off',
      LEAGUE_PHASE: (p) => `${p} nella fase campionato`,
      ABSENT: 'assente',
    },
  },
  'pt-BR': {
    formLine: (t, f) => `${t} chega numa sequência de ${f}`,
    noForm: (t) => `${t} estreia na campanha`,
    opening: (h, a) => `Noite de estreia: ${h} e ${a} começam aqui a campanha — sem sequência para ler, só o gramado.`,
    prevLine: (t, o, h) => `${t} depois de ${h ? 'receber' : 'visitar'} ${o}`,
    tableLine: (h, hp, a, ap) => `A tabela diz ${h} ${hp}, ${a} ${ap} — o gramado terá opinião própria.`,
    knockout: 'Mata-mata: o placar dos 90 minutos alimenta a pontuação; o confronto decide quem respira.',
    decider: 'Jogo decisivo: prorrogação, pênaltis e quem avança — tudo vale ponto.',
    ordinal: (n) => `${n}º`,
    rank: (p) => (p === null ? 'sem classificação' : `nº ${p}`),
    callLine: (h, hr, a, ar, call) => `Coeficientes UEFA: ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} é claro favorito`,
    callFavourite: (t) => `${t} começa como favorito`,
    callEdge: (t) => `${t} leva ligeira vantagem`,
    callEdgeHome: (t) => `${t} leva vantagem jogando em casa`,
    callLevel: 'equilibrado demais para cravar',
    lastSeasonLine: (h, hr, a, ar) => `Na temporada passada: ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Nem ${h} nem ${a} disputaram a competição na temporada passada.`,
    runs: {
      WINNER: 'campeão',
      FINALIST: 'vice-campeão',
      SEMI_FINAL: 'semifinalista',
      QUARTER_FINAL: 'quartas de final',
      ROUND_OF_16: 'eliminado nas oitavas',
      PLAY_OFF: 'eliminado no play-off',
      LEAGUE_PHASE: (p) => `${p} na fase de liga`,
      ABSENT: 'ausente',
    },
  },
  tr: {
    formLine: (t, f) => `${t}, ${f} serisiyle geliyor`,
    noForm: (t) => `${t} kampanyasına başlıyor`,
    opening: (h, a) => `Açılış gecesi: ${h} ve ${a} kampanyalarına burada başlıyor — okunacak seri yok, yalnızca saha var.`,
    prevLine: (t, o, h) => `${t}, ${o} ile oynadıktan sonra (${h ? 'iç saha' : 'deplasman'})`,
    tableLine: (h, hp, a, ap) => `Puan durumu ${h} ${hp}, ${a} ${ap} diyor — sahanın kendi fikri olacak.`,
    knockout: 'Eleme maçı: 90 dakikalık skor puanlamayı besler; turu kimin geçtiğini eşleşme belirler.',
    decider: 'Karar maçı — uzatmalar, penaltılar ve tur atlayan takım: hepsi tahmin edilir.',
    ordinal: (n) => `${n}.`,
    rank: (p) => (p === null ? 'sıralama dışı' : `${p}. sırada`),
    callLine: (h, hr, a, ar, call) => `UEFA katsayıları: ${h} ${hr}, ${a} ${ar} — ${call}.`,
    callClear: (t) => `${t} açık favori`,
    callFavourite: (t) => `${t} favori başlıyor`,
    callEdge: (t) => `${t} az farkla önde`,
    callEdgeHome: (t) => `${t} iç sahada öne geçiyor`,
    callLevel: 'başa baş',
    lastSeasonLine: (h, hr, a, ar) => `Geçen sezon: ${h} ${hr}, ${a} ${ar}.`,
    lastSeasonNeither: (h, a) => `Geçen sezon ne ${h} ne de ${a} turnuvadaydı.`,
    runs: {
      WINNER: 'şampiyon',
      FINALIST: 'finalist',
      SEMI_FINAL: 'yarı finalist',
      QUARTER_FINAL: 'çeyrek finalist',
      ROUND_OF_16: 'son 16’da elendi',
      PLAY_OFF: 'play-off’ta elendi',
      LEAGUE_PHASE: (p) => `lig aşamasında ${p}`,
      ABSENT: 'turnuvada yoktu',
    },
  },
};

/** The run label, with the league-phase finishing position filled in. */
function runLabel(t: T, strength: TeamStrength): string {
  if (strength.prevRun !== 'LEAGUE_PHASE') return t.runs[strength.prevRun];
  return strength.prevLeagueRank === null
    ? t.runs.ABSENT
    : t.runs.LEAGUE_PHASE(t.ordinal(strength.prevLeagueRank));
}

/** "<team> are clear favourites" and friends, from the tier + who it favours. */
function callFor(t: T, facts: MatchFacts, verdict: Verdict): string {
  if (verdict.side === 'level') return t.callLevel;
  const team = verdict.side === 'home' ? facts.home : facts.away;
  if (verdict.tier === 'clear') return t.callClear(team);
  if (verdict.tier === 'favourite') return t.callFavourite(team);
  return verdict.homeGroundDecides ? t.callEdgeHome(team) : t.callEdge(team);
}

export function renderInsight(facts: MatchFacts, locale: InsightLocale): string {
  const t = TEMPLATES[locale];
  const fmtForm = (form: string[]) =>
    form.map((x) => FORM_WORD[locale][x as 'W' | 'D' | 'L']).join('-');
  // form (results exist) > schedule context (draw known, no results) > bare opener
  const side = (team: string, form: string[], prev: PrevFixture | null) =>
    form.length > 0
      ? t.formLine(team, fmtForm(form))
      : prev
        ? t.prevLine(team, prev.opponent, prev.home)
        : t.noForm(team);

  const hasForm = facts.homeForm.length > 0 || facts.awayForm.length > 0;
  const hasPrev = facts.homePrev !== null || facts.awayPrev !== null;
  const parts: string[] = [];

  // 1. What has happened so far, when anything has.
  if (hasForm || hasPrev) {
    parts.push(`${side(facts.home, facts.homeForm, facts.homePrev)}; ${side(facts.away, facts.awayForm, facts.awayPrev)}.`);
  }

  // 2. The call. Published coefficients, so it stands on matchday 1 too.
  if (facts.verdict && facts.homeStrength && facts.awayStrength) {
    parts.push(
      t.callLine(
        facts.home,
        t.rank(facts.homeStrength.coefRank),
        facts.away,
        t.rank(facts.awayStrength.coefRank),
        callFor(t, facts, facts.verdict),
      ),
    );
  }

  // 3. Pedigree, only while there is no form to read — once results exist the
  //    table and the form lines say more about this season than last one does.
  if (!hasForm && facts.homeStrength && facts.awayStrength) {
    const bothAbsent =
      facts.homeStrength.prevRun === 'ABSENT' && facts.awayStrength.prevRun === 'ABSENT';
    parts.push(
      bothAbsent
        ? t.lastSeasonNeither(facts.home, facts.away)
        : t.lastSeasonLine(
            facts.home,
            runLabel(t, facts.homeStrength),
            facts.away,
            runLabel(t, facts.awayStrength),
          ),
    );
  }

  if (facts.homePos !== null && facts.awayPos !== null) {
    parts.push(t.tableLine(facts.home, t.ordinal(facts.homePos), facts.away, t.ordinal(facts.awayPos)));
  }

  // The stage line is context, not substance — it is identical for every
  // knockout fixture, so it never counts as having said something.
  const stage = facts.decider ? t.decider : facts.knockout ? t.knockout : null;

  if (parts.length === 0) {
    // Nothing specific at all: no results, no schedule, no strength data. The
    // matchday-1 opener beats two "open their campaign" stubs — but a bare
    // stage line names neither club, so there the stubs still earn their keep.
    if (!stage) return t.opening(facts.home, facts.away);
    parts.push(`${side(facts.home, facts.homeForm, facts.homePrev)}; ${side(facts.away, facts.awayForm, facts.awayPrev)}.`);
  }
  if (stage) parts.push(stage);
  return parts.join(' ');
}

export function renderAllLocales(facts: MatchFacts): Record<InsightLocale, string> {
  return Object.fromEntries(
    INSIGHT_LOCALES.map((l) => [l, renderInsight(facts, l)]),
  ) as Record<InsightLocale, string>;
}
