// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {MockRWA} from "../src/MockRWA.sol";
import {RWAVault} from "../src/RWAVault.sol";

contract RWAVaultComplianceTest is Test {
    MockRWA internal rwa;
    RWAVault internal vault;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice"); // will be verified
    address internal bob = makeAddr("bob"); // never verified

    uint256 internal constant ONE = 1e18;

    event KycRequirementUpdated(bool required);
    event VerificationUpdated(address indexed account, bool verified);

    function setUp() public {
        rwa = new MockRWA("Tokenized Gold", "tGOLD", admin);
        vault = new RWAVault(rwa, "PortalVault tGOLD", "pvtGOLD", admin);
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            vm.prank(admin);
            rwa.mint(who, 1_000 * ONE);
            vm.prank(who);
            rwa.approve(address(vault), type(uint256).max);
        }
        vm.startPrank(admin);
        vault.setVerified(alice, true);
        vault.setKycRequired(true);
        vm.stopPrank();
    }

    function test_DefaultsAndRoles() public {
        RWAVault fresh = new RWAVault(rwa, "V", "V", admin);
        assertFalse(fresh.kycRequired());
        assertTrue(fresh.canReceiveShares(bob));
        assertTrue(fresh.hasRole(fresh.COMPLIANCE_ROLE(), admin));
    }

    function test_SetKycRequiredEmits() public {
        vm.expectEmit(false, false, false, true, address(vault));
        emit KycRequirementUpdated(false);
        vm.prank(admin);
        vault.setKycRequired(false);
        assertFalse(vault.kycRequired());
    }

    function test_SetVerifiedEmits() public {
        vm.expectEmit(true, false, false, true, address(vault));
        emit VerificationUpdated(bob, true);
        vm.prank(admin);
        vault.setVerified(bob, true);
        assertTrue(vault.isVerified(bob));
    }

    function test_SetVerifiedBatch() public {
        address[] memory list = new address[](2);
        list[0] = bob;
        list[1] = makeAddr("carol");
        vm.prank(admin);
        vault.setVerifiedBatch(list, true);
        assertTrue(vault.isVerified(bob));
        assertTrue(vault.isVerified(list[1]));
    }

    function test_RevertWhen_VerifyZeroAddress() public {
        vm.expectRevert(RWAVault.ZeroAddress.selector);
        vm.prank(admin);
        vault.setVerified(address(0), true);
    }

    function test_RevertWhen_NonComplianceManages() public {
        bytes32 role = vault.COMPLIANCE_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        vault.setVerified(bob, true);

        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        vault.setKycRequired(false);

        address[] memory list = new address[](1);
        list[0] = bob;
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, role));
        vm.prank(bob);
        vault.setVerifiedBatch(list, true);
    }

    function test_MaxViewsReflectEligibility() public view {
        assertEq(vault.maxDeposit(bob), 0);
        assertEq(vault.maxMint(bob), 0);
        assertEq(vault.maxDeposit(alice), type(uint256).max);
        assertEq(vault.maxMint(alice), type(uint256).max);
        assertFalse(vault.canReceiveShares(bob));
    }

    function test_VerifiedCanDeposit() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 * ONE, alice);
        assertGt(shares, 0);
    }

    function test_RevertWhen_UnverifiedDeposits() public {
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, bob, 100 * ONE, 0));
        vm.prank(bob);
        vault.deposit(100 * ONE, bob);
    }

    function test_RevertWhen_DepositForUnverifiedReceiver() public {
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, bob, 100 * ONE, 0));
        vm.prank(alice);
        vault.deposit(100 * ONE, bob);
    }

    function test_RevertWhen_UnverifiedMints() public {
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxMint.selector, bob, 1e24, 0));
        vm.prank(bob);
        vault.mint(1e24, bob);
    }

    function test_RevertWhen_TransferSharesToUnverified() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 * ONE, alice);
        vm.expectRevert(abi.encodeWithSelector(RWAVault.NotVerified.selector, bob));
        vm.prank(alice);
        vault.transfer(bob, shares);
    }

    function test_TransferSharesBetweenVerified() public {
        vm.prank(admin);
        vault.setVerified(bob, true);
        vm.prank(alice);
        uint256 shares = vault.deposit(100 * ONE, alice);
        vm.prank(alice);
        assertTrue(vault.transfer(bob, shares));
        assertEq(vault.balanceOf(bob), shares);
    }

    function test_DeVerifiedHolderCanStillWithdraw() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 * ONE, alice);
        vm.prank(admin);
        vault.setVerified(alice, false);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        assertEq(assets, 100 * ONE);
        assertEq(rwa.balanceOf(alice), 1_000 * ONE);
    }

    function test_DeVerifiedHolderCanWithdrawToAnyReceiver() public {
        vm.prank(alice);
        vault.deposit(100 * ONE, alice);
        vm.prank(admin);
        vault.setVerified(alice, false);
        vm.prank(alice);
        vault.withdraw(40 * ONE, bob, alice); // assets (not shares) go to bob
        assertEq(rwa.balanceOf(bob), 1_040 * ONE);
    }

    function test_DisablingKycOpensTheVault() public {
        vm.prank(admin);
        vault.setKycRequired(false);
        vm.prank(bob);
        assertGt(vault.deposit(10 * ONE, bob), 0);
    }

    function testFuzz_OnlyVerifiedReceiveShares(address who, bool verified) public {
        vm.assume(who != address(0) && who != address(vault));
        vm.prank(admin);
        vault.setVerified(who, verified);
        assertEq(vault.canReceiveShares(who), verified);
        assertEq(vault.maxDeposit(who) > 0, verified);
    }
}
