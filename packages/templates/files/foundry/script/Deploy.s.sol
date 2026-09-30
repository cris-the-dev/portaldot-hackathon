// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {Counter} from "../src/Counter.sol";

/// forge script script/Deploy.s.sol --rpc-url anvil --broadcast   (env: PRIVATE_KEY)
/// On --broadcast, writes ../deployments/<chainId>.json for the web app.
contract Deploy is Script {
    function run() external returns (Counter counter) {
        uint256 deployBlock = block.number;
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        counter = new Counter();
        vm.stopBroadcast();
        console2.log("Counter", address(counter));

        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            vm.serializeUint("d", "chainId", block.chainid);
            vm.serializeUint("d", "deployBlock", deployBlock);
            string memory json = vm.serializeAddress("d", "Counter", address(counter));
            string memory path =
                string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json");
            vm.writeJson(json, path);
            console2.log("wrote", path);
        }
    }
}
