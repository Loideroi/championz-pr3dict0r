// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ChampionzPredictor — v1: two-stage economics (build slice 03)
/// @notice Two stages, two pools, two passes (PRD §4, ADRs 0001–0004):
///         Full Season 1,100 CHZ (500 → League Pool + 500 → Knockout Pool +
///         100 fee) on sale until the league sales close; Knockout 550 CHZ
///         (500 + 50) on sale from that moment until its own close. A stage
///         locking with fewer than FLOOR entrants voids and refunds the FULL
///         gross entry, fee included — therefore fees are ESCROWED per stage
///         and only forwarded to the feeRecipient when the stage locks with a
///         quorum (D2). Scoring stays lazy: no settlement loops anywhere.
contract ChampionzPredictor is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ---- economics (PRD §4.3 — lockstep with lib/economics.ts) ----
    uint256 public constant FULL_SEASON_GROSS = 1100 ether;
    uint256 public constant KNOCKOUT_GROSS = 550 ether;
    uint256 public constant STAKE_PER_STAGE = 500 ether;
    uint256 public constant FEE_PER_STAGE = 50 ether;
    uint32 public constant STAGE_FLOOR = 20; // ADR-0002
    uint256 public constant PREDICTION_LOCKOUT = 3600;

    // ---- scoring (PRD §5; knockout tie bonuses arrive with slice 07) ----
    uint256 public constant POINTS_EXACT = 5;
    uint256 public constant POINTS_GOAL_DIFF = 3;
    uint256 public constant POINTS_OUTCOME = 1;
    uint256 public constant POINTS_BONUS = 1; // per decider flag (§5.2)

    uint256 private constant FLAG_SUBMITTED = 1 << 20;
    uint8 public constant MAX_GOALS = 15;

    // Result-only packing (same low bits as predictions; timestamp on top):
    // bits 24-63 carry provisionalUntil (uint40) — layout-compatible with v1
    // results, which simply read as provisionalUntil == 0 (long finalized).
    uint256 private constant RESULT_TS_SHIFT = 24;
    uint256 private constant RESULT_TS_MASK = uint256(type(uint40).max) << 24;

    uint8 public constant STAGE_LEAGUE = 0;
    uint8 public constant STAGE_KNOCKOUT = 1;

    enum StageStatus {
        SELLING, // entries possible inside the window
        LOCKED, // closed with quorum — pool payable, fees forwarded
        VOID // closed under the floor — full refunds claimable (D2)
    }

    enum MatchStatus {
        SCHEDULED,
        COMPLETED
    }

    struct StageState {
        uint40 openAt;
        uint40 closeAt;
        StageStatus status;
        uint32 entryCount;
        uint256 pool; // 500 per entrant
        uint256 feeEscrow; // 50 per entrant until lock
    }

    struct Game {
        uint40 kickoff;
        MatchStatus status;
        bytes3 teamA;
        bytes3 teamB;
        uint8 stage; // STAGE_LEAGUE | STAGE_KNOCKOUT
    }

    address public feeRecipient;
    address public oracle;
    StageState[2] public stages;
    uint16 public matchCount;
    mapping(uint16 => Game) public matches;
    mapping(uint16 => uint256) private results; // packed
    mapping(uint8 => mapping(address => bool)) public entered; // stage => wallet
    mapping(uint8 => mapping(address => bool)) public refunded;
    mapping(address => bool) public fullSeason; // wallet holds the season pass
    mapping(address => mapping(uint16 => uint256)) private predictions;
    // ---- v2 storage (slice 05) — appended only, never reorder above ----
    /// @dev 0 (pre-upgrade / unset) means DEFAULT_PROVISIONAL_WINDOW applies.
    uint40 public provisionalWindow;

    // ---- v3 storage (slice 07) — appended only ----
    /// @dev Tie metadata kept OUT of the Game struct (upgrade-safe append):
    ///      bit 0 = decider (bonuses apply: PRD §5.2 — second legs + the final),
    ///      bits 1-16 = tieId (0 = no tie).
    mapping(uint16 => uint32) public tieInfo;
    /// @dev Entry timestamps per stage — tie-break #3 (PRD §5.3). Wallets
    ///      enrolled before this upgrade read 0 (sorts as earliest; staging only).
    mapping(uint8 => mapping(address => uint40)) public enteredAt;

    uint40 public constant DEFAULT_PROVISIONAL_WINDOW = 24 hours;

    event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass);
    event StageLocked(uint8 indexed stage, uint32 entryCount, uint256 pool, uint256 feesForwarded);
    event StageVoided(uint8 indexed stage, uint32 entryCount);
    event Refunded(address indexed wallet, uint8 indexed stage, uint256 amount);
    event StageWindowSet(uint8 indexed stage, uint40 openAt, uint40 closeAt);
    event MatchAdded(uint16 indexed matchId, uint8 stage, uint40 kickoff, bytes3 teamA, bytes3 teamB);
    event TieSet(uint16 indexed matchId, uint16 tieId, bool decider);
    event PredictionSubmitted(address indexed wallet, uint16 indexed matchId, uint256 packed);
    event ResultPushed(uint16 indexed matchId, uint8 scoreA, uint8 scoreB);
    event ResultCorrected(uint16 indexed matchId, uint256 oldPacked, uint256 newPacked);
    event KickoffUpdated(uint16 indexed matchId, uint40 kickoff);
    event OracleRotated(address indexed previousOracle, address indexed newOracle);

    error InvalidStakeAmount();
    error AlreadyEntered();
    error NotEntered();
    error SalesClosed();
    error SalesNotOpen();
    error StageNotClosed();
    error StageNotSelling();
    error StageNotVoid();
    error AlreadyRefunded();
    error AlreadyDecided();
    error PredictionsLocked();
    error MatchNotStarted();
    error MatchAlreadyCompleted();
    error UnknownMatch();
    error NotOracle();
    error ResultFinalized();
    error InvalidPrediction();
    error InvalidWindow();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param leagueCloseAt first MD1 kickoff — hard close for season passes (D1)
    ///        and the exact moment knockout sales open (D4: "never closed").
    /// @param knockoutCloseAt T-60min before the last play-off first-leg kickoff (D4).
    function initialize(
        address owner_,
        address feeRecipient_,
        address oracle_,
        uint40 leagueCloseAt,
        uint40 knockoutCloseAt
    ) external initializer {
        if (owner_ == address(0) || feeRecipient_ == address(0) || oracle_ == address(0)) {
            revert ZeroAddress();
        }
        if (leagueCloseAt <= block.timestamp || knockoutCloseAt <= leagueCloseAt) {
            revert InvalidWindow();
        }
        __Ownable_init(owner_);
        feeRecipient = feeRecipient_;
        oracle = oracle_;
        stages[STAGE_LEAGUE] = StageState(uint40(block.timestamp), leagueCloseAt, StageStatus.SELLING, 0, 0, 0);
        stages[STAGE_KNOCKOUT] = StageState(leagueCloseAt, knockoutCloseAt, StageStatus.SELLING, 0, 0, 0);
    }

    // ------------------------------------------------------------ entry ----

    /// @notice One transaction, both stages (PRD §4.1). Exact 1,100 CHZ.
    function enterFullSeason() external payable {
        if (msg.value != FULL_SEASON_GROSS) revert InvalidStakeAmount();
        StageState storage league = stages[STAGE_LEAGUE];
        if (block.timestamp < league.openAt) revert SalesNotOpen();
        if (block.timestamp >= league.closeAt) revert SalesClosed(); // hard close (D1)
        if (entered[STAGE_LEAGUE][msg.sender] || entered[STAGE_KNOCKOUT][msg.sender]) {
            revert AlreadyEntered();
        }
        fullSeason[msg.sender] = true;
        _enroll(STAGE_LEAGUE, msg.sender);
        _enroll(STAGE_KNOCKOUT, msg.sender);
        emit Entered(msg.sender, STAGE_LEAGUE, true);
        emit Entered(msg.sender, STAGE_KNOCKOUT, true);
    }

    /// @notice Latecomer pass — on sale the moment season sales close (D4).
    function enterKnockout() external payable {
        if (msg.value != KNOCKOUT_GROSS) revert InvalidStakeAmount();
        StageState storage ko = stages[STAGE_KNOCKOUT];
        if (block.timestamp < ko.openAt) revert SalesNotOpen();
        if (block.timestamp >= ko.closeAt) revert SalesClosed();
        if (entered[STAGE_KNOCKOUT][msg.sender]) revert AlreadyEntered();
        _enroll(STAGE_KNOCKOUT, msg.sender);
        emit Entered(msg.sender, STAGE_KNOCKOUT, false);
    }

    function _enroll(uint8 stage, address wallet) private {
        StageState storage s = stages[stage];
        entered[stage][wallet] = true;
        enteredAt[stage][wallet] = uint40(block.timestamp); // tie-break #3
        unchecked {
            ++s.entryCount;
        }
        s.pool += STAKE_PER_STAGE;
        s.feeEscrow += FEE_PER_STAGE; // escrowed until lock — D2 refunds include it
    }

    // ---------------------------------------------------- stage lifecycle ----

    /// @notice Permissionless after the window closes: locks the stage with a
    ///         quorum (forwarding escrowed fees) or voids it under the floor.
    function lockStage(uint8 stage) external {
        StageState storage s = _stage(stage);
        if (block.timestamp < s.closeAt) revert StageNotClosed();
        if (s.status != StageStatus.SELLING) revert AlreadyDecided();
        if (s.entryCount < STAGE_FLOOR) {
            s.status = StageStatus.VOID;
            emit StageVoided(stage, s.entryCount);
            return;
        }
        s.status = StageStatus.LOCKED;
        uint256 fees = s.feeEscrow;
        s.feeEscrow = 0;
        (bool ok, ) = feeRecipient.call{value: fees}("");
        if (!ok) revert TransferFailed();
        emit StageLocked(stage, s.entryCount, s.pool, fees);
    }

    /// @notice D2: a voided stage refunds the FULL gross per stage — 550,
    ///         fee included. A voided full-season wallet claims per stage.
    function claimRefund(uint8 stage) external {
        StageState storage s = _stage(stage);
        if (s.status != StageStatus.VOID) revert StageNotVoid();
        if (!entered[stage][msg.sender]) revert NotEntered();
        if (refunded[stage][msg.sender]) revert AlreadyRefunded();
        refunded[stage][msg.sender] = true;
        s.pool -= STAKE_PER_STAGE;
        s.feeEscrow -= FEE_PER_STAGE;
        uint256 amount = STAKE_PER_STAGE + FEE_PER_STAGE;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(msg.sender, stage, amount);
    }

    /// @notice Windows follow the real calendar (draws happen mid-season) —
    ///         owner may adjust while the stage is still selling.
    function setStageWindow(uint8 stage, uint40 openAt, uint40 closeAt) external onlyOwner {
        StageState storage s = _stage(stage);
        if (s.status != StageStatus.SELLING) revert AlreadyDecided();
        if (closeAt <= openAt) revert InvalidWindow();
        s.openAt = openAt;
        s.closeAt = closeAt;
        emit StageWindowSet(stage, openAt, closeAt);
    }

    // ----------------------------------------------------------- matches ----

    function addMatches(
        uint40[] calldata kickoffs,
        bytes3[] calldata teamsA,
        bytes3[] calldata teamsB,
        uint8[] calldata stageIds
    ) external onlyOwner {
        uint256 n = kickoffs.length;
        if (teamsA.length != n || teamsB.length != n || stageIds.length != n) revert InvalidWindow();
        for (uint256 i = 0; i < n; ++i) {
            if (stageIds[i] > STAGE_KNOCKOUT) revert UnknownMatch();
            uint16 id = ++matchCount;
            matches[id] = Game(kickoffs[i], MatchStatus.SCHEDULED, teamsA[i], teamsB[i], stageIds[i]);
            emit MatchAdded(id, stageIds[i], kickoffs[i], teamsA[i], teamsB[i]);
        }
    }

    /// @notice Wire tie metadata (from the generated matches.json — never
    ///         hand-authored). Deciders are second legs + the final (§5.2).
    function setTies(
        uint16[] calldata matchIds,
        uint16[] calldata tieIds,
        bool[] calldata deciders
    ) external onlyOwner {
        uint256 n = matchIds.length;
        if (tieIds.length != n || deciders.length != n) revert InvalidWindow();
        for (uint256 i = 0; i < n; ++i) {
            _match(matchIds[i]); // existence check
            tieInfo[matchIds[i]] = (uint32(tieIds[i]) << 1) | (deciders[i] ? 1 : 0);
            emit TieSet(matchIds[i], tieIds[i], deciders[i]);
        }
    }

    // ------------------------------------------------------- predictions ----

    function submitPrediction(uint16 matchId, uint256 packed) external {
        Game storage g = _match(matchId);
        if (!entered[g.stage][msg.sender]) revert NotEntered();
        if (block.timestamp >= g.kickoff - PREDICTION_LOCKOUT) revert PredictionsLocked();
        if (packed & FLAG_SUBMITTED == 0) revert InvalidPrediction();
        (uint8 a, uint8 b) = _scores(packed);
        if (a > MAX_GOALS || b > MAX_GOALS) revert InvalidPrediction();
        predictions[msg.sender][matchId] = packed;
        emit PredictionSubmitted(msg.sender, matchId, packed);
    }

    /// @notice One transaction per matchday (PRD §6/§10) — arrays must align.
    function submitPredictions(uint16[] calldata matchIds, uint256[] calldata packeds) external {
        uint256 n = matchIds.length;
        if (packeds.length != n) revert InvalidPrediction();
        for (uint256 i = 0; i < n; ++i) {
            Game storage g = _match(matchIds[i]);
            if (!entered[g.stage][msg.sender]) revert NotEntered();
            if (block.timestamp >= g.kickoff - PREDICTION_LOCKOUT) revert PredictionsLocked();
            uint256 packed = packeds[i];
            if (packed & FLAG_SUBMITTED == 0) revert InvalidPrediction();
            (uint8 a, uint8 b) = _scores(packed);
            if (a > MAX_GOALS || b > MAX_GOALS) revert InvalidPrediction();
            predictions[msg.sender][matchIds[i]] = packed;
            emit PredictionSubmitted(msg.sender, matchIds[i], packed);
        }
    }

    function predictionOf(address wallet, uint16 matchId) external view returns (uint256) {
        return predictions[wallet][matchId];
    }

    // ------------------------------------------------------------ oracle ----

    /// @notice v2: push the full packed result (90′ scores + knockout flags,
    ///         mirror-UEFA verbatim per ADR-0006). Lands PROVISIONAL for the
    ///         dispute window (D9: scores count immediately, badge in UI),
    ///         then finalizes by pure passage of time — no finalize tx.
    function pushResult(uint16 matchId, uint256 packed) external onlyOracle {
        Game storage g = _match(matchId);
        if (block.timestamp < g.kickoff) revert MatchNotStarted();
        if (g.status == MatchStatus.COMPLETED) revert MatchAlreadyCompleted();
        if (packed & FLAG_SUBMITTED == 0 || packed & RESULT_TS_MASK != 0) revert InvalidPrediction();
        (uint8 a, uint8 b) = _scores(packed);
        if (a > MAX_GOALS || b > MAX_GOALS) revert InvalidPrediction();
        g.status = MatchStatus.COMPLETED;
        uint256 until = block.timestamp + _provisionalWindow();
        results[matchId] = packed | (until << RESULT_TS_SHIFT);
        emit ResultPushed(matchId, a, b);
    }

    /// @notice Oracle self-correction inside the provisional window only
    ///         (UEFA amends a score; the relayer follows). Post-finalization
    ///         corrections are the pause-gated slice-12 path — not this.
    function correctResult(uint16 matchId, uint256 packed) external onlyOracle {
        uint256 existing = results[matchId];
        if (existing == 0) revert UnknownMatch();
        if (block.timestamp >= _provisionalUntil(existing)) revert ResultFinalized();
        if (packed & FLAG_SUBMITTED == 0 || packed & RESULT_TS_MASK != 0) revert InvalidPrediction();
        (uint8 a, uint8 b) = _scores(packed);
        if (a > MAX_GOALS || b > MAX_GOALS) revert InvalidPrediction();
        // correction re-arms the window
        uint256 until = block.timestamp + _provisionalWindow();
        results[matchId] = packed | (until << RESULT_TS_SHIFT);
        emit ResultCorrected(matchId, existing, packed);
    }

    /// @notice UEFA reschedules matches; the relayer follows (SCHEDULED only).
    function batchUpdateKickoffs(uint16[] calldata matchIds, uint40[] calldata kickoffs)
        external
        onlyOracle
    {
        uint256 n = matchIds.length;
        if (kickoffs.length != n) revert InvalidWindow();
        for (uint256 i = 0; i < n; ++i) {
            Game storage g = _match(matchIds[i]);
            if (g.status != MatchStatus.SCHEDULED) revert MatchAlreadyCompleted();
            g.kickoff = kickoffs[i];
            emit KickoffUpdated(matchIds[i], kickoffs[i]);
        }
    }

    function setProvisionalWindow(uint40 window) external onlyOwner {
        provisionalWindow = window;
    }

    function _provisionalWindow() private view returns (uint40) {
        return provisionalWindow == 0 ? DEFAULT_PROVISIONAL_WINDOW : provisionalWindow;
    }

    function _provisionalUntil(uint256 packedResult) private pure returns (uint256) {
        return (packedResult & RESULT_TS_MASK) >> RESULT_TS_SHIFT;
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleRotated(oracle, newOracle);
        oracle = newOracle;
    }

    // ------------------------------------------------------ lazy scoring ----

    /// @notice Pure function of (predictions, results); bounded by matchCount.
    ///         Scoreline 5/3/1 on the 90′ score for every match; the three +1
    ///         bonuses (ET / pens / advancer) apply on DECIDERS only (§5.2).
    function pointsOf(address wallet, uint8 stage) public view returns (uint256 total) {
        uint16 n = matchCount;
        for (uint16 id = 1; id <= n; ++id) {
            total += _pointsForMatch(wallet, id, stage);
        }
    }

    /// @notice Tie-break #2 (§5.3): count of exact scorelines in a stage.
    function exactCountOf(address wallet, uint8 stage) external view returns (uint256 count) {
        uint16 n = matchCount;
        for (uint16 id = 1; id <= n; ++id) {
            Game storage g = matches[id];
            if (g.stage != stage || g.status != MatchStatus.COMPLETED) continue;
            uint256 packed = predictions[wallet][id];
            if (packed & FLAG_SUBMITTED == 0) continue;
            (uint8 pa, uint8 pb) = _scores(packed);
            (uint8 ra, uint8 rb) = _scores(results[id]);
            if (pa == ra && pb == rb) ++count;
        }
    }

    function _pointsForMatch(address wallet, uint16 id, uint8 stage) private view returns (uint256 pts) {
        Game storage g = matches[id];
        if (g.stage != stage || g.status != MatchStatus.COMPLETED) return 0;
        uint256 packed = predictions[wallet][id];
        if (packed & FLAG_SUBMITTED == 0) return 0;
        uint256 res = results[id];
        (uint8 pa, uint8 pb) = _scores(packed);
        (uint8 ra, uint8 rb) = _scores(res);
        if (pa == ra && pb == rb) pts = POINTS_EXACT;
        else if (int16(uint16(pa)) - int16(uint16(pb)) == int16(uint16(ra)) - int16(uint16(rb))) {
            pts = POINTS_GOAL_DIFF;
        } else if (_sign(pa, pb) == _sign(ra, rb)) pts = POINTS_OUTCOME;

        if (tieInfo[id] & 1 == 1) {
            // decider bonuses: +1 per correctly-called flag (§5)
            if ((packed >> 16) & 1 == (res >> 16) & 1) pts += POINTS_BONUS;
            if ((packed >> 17) & 1 == (res >> 17) & 1) pts += POINTS_BONUS;
            if ((packed >> 18) & 3 == (res >> 18) & 3) pts += POINTS_BONUS;
        }
    }

    function resultOf(uint16 matchId)
        external
        view
        returns (
            uint8 scoreA,
            uint8 scoreB,
            bool extraTime,
            bool penalties,
            uint8 advancer,
            bool completed,
            bool provisional
        )
    {
        uint256 packed = results[matchId];
        (scoreA, scoreB) = _scores(packed);
        extraTime = packed & (1 << 16) != 0;
        penalties = packed & (1 << 17) != 0;
        advancer = uint8((packed >> 18) & 3);
        completed = matches[matchId].status == MatchStatus.COMPLETED;
        provisional = completed && block.timestamp < _provisionalUntil(packed);
    }

    // ----------------------------------------------------------- helpers ----

    function _stage(uint8 stage) private view returns (StageState storage) {
        if (stage > STAGE_KNOCKOUT) revert UnknownMatch();
        return stages[stage];
    }

    function _match(uint16 matchId) private view returns (Game storage g) {
        g = matches[matchId];
        if (g.kickoff == 0) revert UnknownMatch();
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

    // No receive/fallback on purpose (predecessor audit L-04).
}
