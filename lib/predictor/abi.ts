/** Minimal v1 ABI — keep in sync with contracts/src/ChampionzPredictor.sol. */
export const PREDICTOR_ABI = [
  { type: "function", name: "enterFullSeason", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "enterKnockout", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "claimRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "stage", type: "uint8" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lockStage",
    stateMutability: "nonpayable",
    inputs: [{ name: "stage", type: "uint8" }],
    outputs: [],
  },
  {
    type: "function",
    name: "stages",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "openAt", type: "uint40" },
      { name: "closeAt", type: "uint40" },
      { name: "status", type: "uint8" },
      { name: "entryCount", type: "uint32" },
      { name: "pool", type: "uint256" },
      { name: "feeEscrow", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "entered",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint8" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "fullSeason",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "matchCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint16" }],
    outputs: [
      { name: "kickoff", type: "uint40" },
      { name: "status", type: "uint8" },
      { name: "teamA", type: "bytes3" },
      { name: "teamB", type: "bytes3" },
      { name: "stage", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "submitPrediction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint16" },
      { name: "packed", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submitPredictions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchIds", type: "uint16[]" },
      { name: "packeds", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "predictionOf",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "matchId", type: "uint16" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pointsOf",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "stage", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "resultOf",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint16" }],
    outputs: [
      { name: "scoreA", type: "uint8" },
      { name: "scoreB", type: "uint8" },
      { name: "extraTime", type: "bool" },
      { name: "penalties", type: "bool" },
      { name: "advancer", type: "uint8" },
      { name: "completed", type: "bool" },
      { name: "provisional", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "exactCountOf",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "stage", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "enteredAt",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint8" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint40" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [{ name: "stage", type: "uint8" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimable",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint8" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "stageFrozen",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint8" }],
    outputs: [{ type: "bool" }],
  },
  // ---- admin console (slice 12) ----
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "resultSourceRef", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "forceCorrectResult",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint16" },
      { name: "packed", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "voidMatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "uint16" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setMatchTeams",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint16" },
      { name: "teamA", type: "bytes3" },
      { name: "teamB", type: "bytes3" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setStageWindow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stage", type: "uint8" },
      { name: "openAt", type: "uint40" },
      { name: "closeAt", type: "uint40" },
    ],
    outputs: [],
  },
  { type: "function", name: "lockStage", stateMutability: "nonpayable", inputs: [{ name: "stage", type: "uint8" }], outputs: [] },
  {
    type: "function",
    name: "freezeStage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "stage", type: "uint8" },
      { name: "ranked", type: "address[]" },
    ],
    outputs: [],
  },
  { type: "function", name: "setOracle", stateMutability: "nonpayable", inputs: [{ name: "newOracle", type: "address" }], outputs: [] },
  { type: "function", name: "setResultSource", stateMutability: "nonpayable", inputs: [{ name: "ref", type: "string" }], outputs: [] },
  {
    type: "event",
    name: "Entered",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "stage", type: "uint8", indexed: true },
      { name: "fullSeasonPass", type: "bool", indexed: false },
    ],
  },
] as const;

export const PREDICTOR_ADDRESS = (process.env.NEXT_PUBLIC_PREDICTOR_ADDRESS ??
  "") as `0x${string}`;

export const STAGE_LEAGUE = 0;
export const STAGE_KNOCKOUT = 1;
export const FULL_SEASON_GROSS_WEI = 1100n * 10n ** 18n;
export const KNOCKOUT_GROSS_WEI = 550n * 10n ** 18n;
