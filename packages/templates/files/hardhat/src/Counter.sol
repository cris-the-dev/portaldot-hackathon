// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Counter {
    uint256 public number;

    event NumberChanged(address indexed by, uint256 number);

    function setNumber(uint256 newNumber) external {
        number = newNumber;
        emit NumberChanged(msg.sender, newNumber);
    }

    function increment() external {
        number++;
        emit NumberChanged(msg.sender, number);
    }
}
