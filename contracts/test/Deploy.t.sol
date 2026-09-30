// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {MockRWA} from "../src/MockRWA.sol";
import {RWAVault} from "../src/RWAVault.sol";

contract DeployTest is Test {
    function test_DeployWiresContractsAndRoles() public {
        uint256 pk = 0xA11CE;
        address admin = vm.addr(pk);
        vm.setEnv("PRIVATE_KEY", vm.toString(pk));
        vm.setEnv("RWA_SYMBOL", "tGOLD");

        (MockRWA rwa, RWAVault vault) = new Deploy().run();

        assertEq(vault.asset(), address(rwa));
        assertEq(rwa.symbol(), "tGOLD");
        assertEq(vault.symbol(), "pvtGOLD");
        assertTrue(rwa.hasRole(rwa.ISSUER_ROLE(), admin));
        assertTrue(vault.hasRole(vault.YIELD_MANAGER_ROLE(), admin));
    }
}
