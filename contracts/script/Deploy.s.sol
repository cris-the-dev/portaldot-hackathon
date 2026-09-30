// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {MockRWA} from "../src/MockRWA.sol";
import {RWAVault} from "../src/RWAVault.sol";

/// @notice Deploys MockRWA + RWAVault.
///   forge script script/Deploy.s.sol --rpc-url anvil --broadcast
/// Env: PRIVATE_KEY (required), RWA_NAME / RWA_SYMBOL (optional).
/// On --broadcast, addresses are written to config/deployments/<chainId>.json for the frontends.
contract Deploy is Script {
    function run() external returns (MockRWA rwa, RWAVault vault) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);
        string memory name = vm.envOr("RWA_NAME", string("Tokenized Gold"));
        string memory symbol = vm.envOr("RWA_SYMBOL", string("tGOLD"));
        uint256 deployBlock = block.number;

        vm.startBroadcast(pk);
        rwa = new MockRWA(name, symbol, admin);
        vault = new RWAVault(rwa, string.concat("PortalVault ", symbol), string.concat("pv", symbol), admin);
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("MockRWA", address(rwa));
        console2.log("RWAVault", address(vault));

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            _writeDeployment(address(rwa), address(vault), deployBlock);
        }
    }

    function _writeDeployment(address rwa, address vault, uint256 deployBlock) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeUint(key, "deployBlock", deployBlock);
        vm.serializeAddress(key, "MockRWA", rwa);
        string memory json = vm.serializeAddress(key, "RWAVault", vault);
        string memory path =
            string.concat(vm.projectRoot(), "/../config/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("wrote", path);
    }
}
