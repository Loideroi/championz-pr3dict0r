// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ChampionzPredictor — v0 walking skeleton (build slice 02)
/// @notice Thinnest complete path: exact 550 CHZ entry, one match, packed
///         prediction with 60-min lockout + overwrite, oracle-pushed result,
///         lazy (view-time) scoring. No settlement transactions, ever.
/// @dev Slice 03 adds stages/pools/windows/floor; slice 05+ the full oracle
///      lifecycle. Scoring here is the base 5/3/1 rubric on the 90-minute
///      score (PRD §5.1); knockout tie bonuses arrive with the tie model.
contract ChampionzPredictor is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ---- economics (PRD §4.3 — keep in lockstep with lib/economics.ts) ----
    uint256 public constant ENTRY_GROSS = 550 ether;
    uint256 public constant ENTRY_POOL = 500 ether;
    uint256 public constant ENTRY_FEE = 50 ether;
    uint256 public constant PREDICTION_LOCKOUT = 3600;

    // ---- scoring (PRD §5) ----
    uint256 public constant POINTS_EXACT = 5;
    uint256 public constant POINTS_GOAL_DIFF = 3;
    uint256 public constant POINTS_OUTCOME = 1;

    // ---- packed prediction/result layout (predecessor-compatible) ----
    // bits 0-7 scoreA · 8-15 scoreB · 16 extraTime · 17 penalties
    // bits 18-19 advancer · bit 20 submitted
    uint256 private constant FLAG_SUBMITTED = 1 << 20;
    uint8 public constant MAX_GOALS = 15;

    enum MatchStatus {
        SCHEDULED,
        COMPLETED
    }

    struct Game {
        uint40 kickoff;
        MatchStatus status;
        bytes3 teamA;
        bytes3 teamB;
    }

    address public feeRecipient;
    address public oracle;
    Game public game; // v0: a single match
    uint256 private result; // packed, same layout as predictions
    uint256 public pool;
    uint256 public entryCount;
    mapping(address => bool) public entered;
    mapping(address => uint256) private predictions;

    event Entered(address indexed wallet, uint256 pool, uint256 entryCount);
    event PredictionSubmitted(address indexed wallet, uint256 packed);
    event ResultPushed(uint8 scoreA, uint8 scoreB);
    event OracleRotated(address indexed previousOracle, address indexed newOracle);

    error InvalidStakeAmount();
    error AlreadyEntered();
    error NotEntered();
    error PredictionsLocked();
    error MatchNotStarted();
    error MatchAlreadyCompleted();
    error NotOracle();
    error InvalidPrediction();
    error ZeroAddress();
    error FeeTransferFailed();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address feeRecipient_,
        address oracle_,
        uint40 kickoff_,
        bytes3 teamA_,
        bytes3 teamB_
    ) external initializer {
        if (owner_ == address(0) || feeRecipient_ == address(0) || oracle_ == address(0)) {
            revert ZeroAddress();
        }
        __Ownable_init(owner_);
        feeRecipient = feeRecipient_;
        oracle = oracle_;
        game = Game({kickoff: kickoff_, status: MatchStatus.SCHEDULED, teamA: teamA_, teamB: teamB_});
    }

    // ------------------------------------------------------------ entry ----

    function enter() external payable {
        if (msg.value != ENTRY_GROSS) revert InvalidStakeAmount();
        if (entered[msg.sender]) revert AlreadyEntered();
        entered[msg.sender] = true;
        unchecked {
            ++entryCount;
        }
        pool += ENTRY_POOL;
        (bool ok, ) = feeRecipient.call{value: ENTRY_FEE}("");
        if (!ok) revert FeeTransferFailed();
        emit Entered(msg.sender, pool, entryCount);
    }

    // ------------------------------------------------------- predictions ----

    /// @notice Submit or overwrite the prediction. Editing before lockout is a
    ///         first-class feature (PRD §6) — the caller just re-pays gas.
    function submitPrediction(uint256 packed) external {
        if (!entered[msg.sender]) revert NotEntered();
        if (block.timestamp >= game.kickoff - PREDICTION_LOCKOUT) revert PredictionsLocked();
        if (packed & FLAG_SUBMITTED == 0) revert InvalidPrediction();
        (uint8 a, uint8 b) = _scores(packed);
        if (a > MAX_GOALS || b > MAX_GOALS) revert InvalidPrediction();
        predictions[msg.sender] = packed;
        emit PredictionSubmitted(msg.sender, packed);
    }

    function predictionOf(address wallet) external view returns (uint256) {
        return predictions[wallet];
    }

    // ------------------------------------------------------------ oracle ----

    /// @notice Push the 90-minute result (score.regular — never the AET total).
    function pushResult(uint8 scoreA, uint8 scoreB) external onlyOracle {
        if (block.timestamp < game.kickoff) revert MatchNotStarted();
        if (game.status == MatchStatus.COMPLETED) revert MatchAlreadyCompleted();
        game.status = MatchStatus.COMPLETED;
        result = _pack(scoreA, scoreB);
        emit ResultPushed(scoreA, scoreB);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleRotated(oracle, newOracle);
        oracle = newOracle;
    }

    // ------------------------------------------------------ lazy scoring ----

    /// @notice Points are a pure function of (prediction, result) — computed on
    ///         read, verified at freeze/claim time in later slices. No
    ///         settlement loops exist anywhere in this contract.
    function pointsOf(address wallet) external view returns (uint256) {
        if (game.status != MatchStatus.COMPLETED) return 0;
        uint256 packed = predictions[wallet];
        if (packed & FLAG_SUBMITTED == 0) return 0;
        (uint8 pa, uint8 pb) = _scores(packed);
        (uint8 ra, uint8 rb) = _scores(result);
        if (pa == ra && pb == rb) return POINTS_EXACT;
        if (int16(uint16(pa)) - int16(uint16(pb)) == int16(uint16(ra)) - int16(uint16(rb))) {
            return POINTS_GOAL_DIFF;
        }
        if (_sign(pa, pb) == _sign(ra, rb)) return POINTS_OUTCOME;
        return 0;
    }

    function resultOf() external view returns (uint8 scoreA, uint8 scoreB, bool completed) {
        (scoreA, scoreB) = _scores(result);
        completed = game.status == MatchStatus.COMPLETED;
    }

    // ----------------------------------------------------------- helpers ----

    function _pack(uint8 a, uint8 b) private pure returns (uint256) {
        return uint256(a) | (uint256(b) << 8) | FLAG_SUBMITTED;
    }

    function _scores(uint256 packed) private pure returns (uint8 a, uint8 b) {
        a = uint8(packed);
        b = uint8(packed >> 8);
    }

    function _sign(uint8 a, uint8 b) private pure returns (int8) {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // No receive/fallback on purpose: reject accidental transfers
    // (predecessor audit L-04).
}
