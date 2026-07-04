/** Minimal v0 ABI — keep in sync with contracts/src/ChampionzPredictor.sol. */
export const PREDICTOR_ABI = [
  {
    type: "function",
    name: "enter",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "submitPrediction",
    stateMutability: "nonpayable",
    inputs: [{ name: "packed", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "entered",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "predictionOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pointsOf",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "resultOf",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "scoreA", type: "uint8" },
      { name: "scoreB", type: "uint8" },
      { name: "completed", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "game",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "kickoff", type: "uint40" },
      { name: "status", type: "uint8" },
      { name: "teamA", type: "bytes3" },
      { name: "teamB", type: "bytes3" },
    ],
  },
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "entryCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const PREDICTOR_ADDRESS = (process.env.NEXT_PUBLIC_PREDICTOR_ADDRESS ??
  "") as `0x${string}`;

export const ENTRY_GROSS_WEI = 550n * 10n ** 18n;
