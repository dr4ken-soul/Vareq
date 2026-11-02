// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReferenceRaceFixture} from "../src/ReferenceRaceFixture.sol";

interface Vm {
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
}

contract ReferenceRaceFixtureTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant USER = address(0xA11CE);
    address private constant OPERATOR = address(0xB0B);
    uint64 private constant REFUND_TICK = 10;

    function testVulnerableFixtureReproducesDoubleSettlementAndFailedClaim() external {
        ReferenceRaceFixture fixture = new ReferenceRaceFixture(USER, OPERATOR, false, REFUND_TICK);
        vm.prank(USER);
        fixture.lock(100);
        fixture.issueFillPermit();
        fixture.advanceLogicalTime(REFUND_TICK + 1);
        vm.prank(USER);
        fixture.requestRefund();
        vm.prank(OPERATOR);
        fixture.deliverFill();
        vm.expectRevert(ReferenceRaceFixture.InvalidState.selector);
        vm.prank(OPERATOR);
        fixture.claim();

        require(fixture.sourceRefunded(), "refund must be observed");
        require(fixture.destinationFilled(), "late fill must be observed");
        require(!fixture.operatorReimbursed(), "claim must fail after refund");
        require(!fixture.noDoubleSettlement(), "the intended counterexample must be visible");
    }

    function testPatchedFixtureRejectsConflictingRefundAndReimbursesOperator() external {
        ReferenceRaceFixture fixture = new ReferenceRaceFixture(USER, OPERATOR, true, REFUND_TICK);
        vm.prank(USER);
        fixture.lock(100);
        fixture.issueFillPermit();
        fixture.advanceLogicalTime(REFUND_TICK + 1);
        vm.expectRevert(ReferenceRaceFixture.ConflictingDecision.selector);
        vm.prank(USER);
        fixture.requestRefund();
        vm.prank(OPERATOR);
        fixture.deliverFill();
        vm.prank(OPERATOR);
        fixture.claim();

        require(!fixture.sourceRefunded(), "refund must be refused");
        require(fixture.destinationFilled(), "fill must succeed");
        require(fixture.operatorReimbursed(), "operator claim must succeed");
        require(fixture.noDoubleSettlement(), "invariant must hold for this sequence");
    }

    function testWrongRolesCannotAdvanceState() external {
        ReferenceRaceFixture fixture = new ReferenceRaceFixture(USER, OPERATOR, false, REFUND_TICK);
        vm.expectRevert(ReferenceRaceFixture.Unauthorized.selector);
        fixture.lock(100);
    }
}
