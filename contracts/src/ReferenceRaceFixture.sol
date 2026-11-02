// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Educational, valueless state-machine fixture. Never use with real assets.
/// @dev Both versions run in one local EVM so the coordinator decision is globally shared.
///      This deliberately does not represent a deployable cross-chain bridge.
contract ReferenceRaceFixture {
    enum Decision {
        None,
        Fill,
        Refund
    }

    address public immutable owner;
    address public immutable user;
    address public immutable operator;
    bool public immutable patched;
    uint64 public immutable refundAfterTick;

    Decision public decision;
    bool public locked;
    bool public fillPermit;
    bool public sourceRefunded;
    bool public destinationFilled;
    bool public operatorReimbursed;
    uint64 public logicalTick;
    uint256 public referenceUnits;

    error Unauthorized();
    error InvalidState();
    error RefundWindowClosed();
    error ConflictingDecision();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyUser() {
        if (msg.sender != user) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address user_, address operator_, bool patched_, uint64 refundAfterTick_) {
        if (user_ == address(0) || operator_ == address(0) || user_ == operator_) revert InvalidState();
        owner = msg.sender;
        user = user_;
        operator = operator_;
        patched = patched_;
        refundAfterTick = refundAfterTick_;
    }

    function lock(uint256 amount) external onlyUser {
        if (locked || amount == 0) revert InvalidState();
        locked = true;
        referenceUnits = amount;
    }

    /// Coordinator action: the local fixture persists its decision before exposing a permit.
    function issueFillPermit() external onlyOwner {
        if (!locked || fillPermit || sourceRefunded) revert InvalidState();
        if (patched) {
            if (decision != Decision.None) revert ConflictingDecision();
            decision = Decision.Fill;
        }
        fillPermit = true;
    }

    function advanceLogicalTime(uint64 nextTick) external onlyOwner {
        if (nextTick < logicalTick) revert InvalidState();
        logicalTick = nextTick;
    }

    function requestRefund() external onlyUser {
        if (!locked || sourceRefunded) revert InvalidState();
        if (logicalTick < refundAfterTick) revert RefundWindowClosed();
        if (patched) {
            if (decision == Decision.Fill) revert ConflictingDecision();
            if (decision == Decision.None) decision = Decision.Refund;
        }
        sourceRefunded = true;
    }

    function deliverFill() external onlyOperator {
        if (!fillPermit || destinationFilled) revert InvalidState();
        destinationFilled = true;
    }

    function claim() external onlyOperator {
        if (!destinationFilled || sourceRefunded || operatorReimbursed) revert InvalidState();
        operatorReimbursed = true;
    }

    function noDoubleSettlement() external view returns (bool) {
        return !(sourceRefunded && destinationFilled);
    }
}
