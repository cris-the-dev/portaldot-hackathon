// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter internal counter;

    event NumberChanged(address indexed by, uint256 number);

    function setUp() public {
        counter = new Counter();
    }

    function test_Increment() public {
        vm.expectEmit(true, false, false, true);
        emit NumberChanged(address(this), 1);
        counter.increment();
        assertEq(counter.number(), 1);
    }

    function testFuzz_SetNumber(uint256 x) public {
        counter.setNumber(x);
        assertEq(counter.number(), x);
    }
}
