// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {MockRWA} from "../src/MockRWA.sol";
import {RWAVault} from "../src/RWAVault.sol";

contract RWAVaultTest is Test {
    MockRWA internal rwa;
    RWAVault internal vault;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant ONE = 1e18;
    uint256 internal constant OFFSET = 1e6; // 10 ** DECIMALS_OFFSET
    uint256 internal constant MAX_FUZZ = 1e30;

    event YieldDeposited(address indexed from, uint256 assets, uint256 totalAssetsAfter);

    function setUp() public {
        rwa = new MockRWA("Tokenized Gold", "tGOLD", admin);
        vault = new RWAVault(rwa, "PortalVault tGOLD", "pvtGOLD", admin);

        _fund(alice, 1_000 * ONE);
        _fund(bob, 1_000 * ONE);
        _fund(admin, 1_000 * ONE);
    }

    // ---------- helpers ----------

    function _fund(address who, uint256 amount) internal {
        vm.prank(admin);
        rwa.mint(who, amount);
        vm.prank(who);
        rwa.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 assets) internal returns (uint256 shares) {
        vm.prank(who);
        shares = vault.deposit(assets, who);
    }

    function _yield(uint256 assets) internal {
        vm.prank(admin);
        vault.depositYield(assets);
    }

    // ---------- construction ----------

    function test_Metadata() public view {
        assertEq(vault.asset(), address(rwa));
        assertEq(vault.name(), "PortalVault tGOLD");
        assertEq(vault.symbol(), "pvtGOLD");
        assertEq(vault.decimals(), 18 + 6);
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.totalSupply(), 0);
    }

    function test_ConstructorGrantsRoles() public view {
        assertTrue(vault.hasRole(vault.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(vault.hasRole(vault.YIELD_MANAGER_ROLE(), admin));
        assertFalse(vault.hasRole(vault.YIELD_MANAGER_ROLE(), alice));
    }

    function test_RevertWhen_ZeroAdmin() public {
        vm.expectRevert(RWAVault.ZeroAddress.selector);
        new RWAVault(rwa, "V", "V", address(0));
    }

    function test_RevertWhen_ZeroAsset() public {
        // ERC4626's constructor probes asset decimals; a zero address must still be rejected.
        vm.expectRevert(RWAVault.ZeroAddress.selector);
        new RWAVault(MockRWA(address(0)), "V", "V", admin);
    }

    // ---------- core ERC-4626 flows ----------

    function test_Deposit() public {
        uint256 expected = vault.previewDeposit(100 * ONE);
        uint256 shares = _deposit(alice, 100 * ONE);
        assertEq(shares, expected);
        assertEq(shares, 100 * ONE * OFFSET); // 1:1 at start, scaled by the decimals offset
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), 100 * ONE);
        assertEq(rwa.balanceOf(alice), 900 * ONE);
    }

    function test_DepositForReceiver() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(10 * ONE, bob);
        assertEq(vault.balanceOf(bob), shares);
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_Mint() public {
        uint256 shares = 50 * ONE * OFFSET;
        uint256 expectedAssets = vault.previewMint(shares);
        vm.prank(alice);
        uint256 assets = vault.mint(shares, alice);
        assertEq(assets, expectedAssets);
        assertEq(assets, 50 * ONE);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), assets);
    }

    function test_Withdraw() public {
        _deposit(alice, 100 * ONE);
        uint256 expectedShares = vault.previewWithdraw(40 * ONE);
        vm.prank(alice);
        uint256 burned = vault.withdraw(40 * ONE, alice, alice);
        assertEq(burned, expectedShares);
        assertEq(rwa.balanceOf(alice), 940 * ONE);
        assertEq(vault.totalAssets(), 60 * ONE);
    }

    function test_Redeem() public {
        uint256 shares = _deposit(alice, 100 * ONE);
        uint256 expectedAssets = vault.previewRedeem(shares);
        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        assertEq(assets, expectedAssets);
        assertEq(assets, 100 * ONE);
        assertEq(vault.balanceOf(alice), 0);
        assertEq(rwa.balanceOf(alice), 1_000 * ONE);
    }

    function test_RedeemOnBehalfWithAllowance() public {
        uint256 shares = _deposit(alice, 100 * ONE);
        vm.prank(alice);
        vault.approve(bob, shares);
        vm.prank(bob);
        vault.redeem(shares, bob, alice);
        assertEq(rwa.balanceOf(bob), 1_100 * ONE);
        assertEq(vault.allowance(alice, bob), 0);
    }

    function test_RevertWhen_WithdrawOnBehalfWithoutAllowance() public {
        _deposit(alice, 100 * ONE);
        uint256 shares = vault.previewWithdraw(ONE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, shares));
        vm.prank(bob);
        vault.withdraw(ONE, bob, alice);
    }

    function test_RevertWhen_WithdrawMoreThanMax() public {
        _deposit(alice, 100 * ONE);
        uint256 max = vault.maxWithdraw(alice);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxWithdraw.selector, alice, max + 1, max));
        vm.prank(alice);
        vault.withdraw(max + 1, alice, alice);
    }

    function test_RevertWhen_RedeemMoreThanMax() public {
        uint256 shares = _deposit(alice, 100 * ONE);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxRedeem.selector, alice, shares + 1, shares));
        vm.prank(alice);
        vault.redeem(shares + 1, alice, alice);
    }

    function test_MaxViews() public {
        assertEq(vault.maxDeposit(alice), type(uint256).max);
        assertEq(vault.maxMint(alice), type(uint256).max);
        assertEq(vault.maxWithdraw(alice), 0);
        assertEq(vault.maxRedeem(alice), 0);
        uint256 shares = _deposit(alice, 100 * ONE);
        assertEq(vault.maxWithdraw(alice), 100 * ONE);
        assertEq(vault.maxRedeem(alice), shares);
    }

    function test_ConvertViews() public {
        _deposit(alice, 100 * ONE);
        assertEq(vault.convertToShares(ONE), ONE * OFFSET);
        assertEq(vault.convertToAssets(ONE * OFFSET), ONE);
    }

    function test_ShareTransfer() public {
        uint256 shares = _deposit(alice, 100 * ONE);
        vm.prank(alice);
        assertTrue(vault.transfer(bob, shares / 2));
        assertEq(vault.balanceOf(bob), shares / 2);
        assertEq(vault.maxWithdraw(bob), 50 * ONE);
    }

    // ---------- yield ----------

    function test_DepositYieldRaisesSharePrice() public {
        uint256 shares = _deposit(alice, 100 * ONE);
        uint256 unit = 10 ** vault.decimals();
        uint256 priceBefore = vault.convertToAssets(unit);

        vm.expectEmit(true, false, false, true, address(vault));
        emit YieldDeposited(admin, 10 * ONE, 110 * ONE);
        _yield(10 * ONE);

        assertEq(vault.totalAssets(), 110 * ONE);
        assertEq(vault.totalSupply(), shares); // no new shares minted
        assertGt(vault.convertToAssets(unit), priceBefore);
        assertApproxEqAbs(vault.previewRedeem(shares), 110 * ONE, 1);
    }

    function test_YieldSplitProRata() public {
        uint256 aliceShares = _deposit(alice, 300 * ONE);
        uint256 bobShares = _deposit(bob, 100 * ONE);
        _yield(40 * ONE); // +10%

        vm.prank(alice);
        uint256 aliceOut = vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        uint256 bobOut = vault.redeem(bobShares, bob, bob);

        assertApproxEqAbs(aliceOut, 330 * ONE, 1);
        assertApproxEqAbs(bobOut, 110 * ONE, 1);
    }

    function test_LateDepositorDoesNotCaptureEarlierYield() public {
        _deposit(alice, 100 * ONE);
        _yield(100 * ONE); // price doubles
        uint256 bobShares = _deposit(bob, 100 * ONE);
        vm.prank(bob);
        uint256 bobOut = vault.redeem(bobShares, bob, bob);
        assertApproxEqAbs(bobOut, 100 * ONE, 1);
    }

    function test_RevertWhen_NonManagerDepositsYield() public {
        bytes32 role = vault.YIELD_MANAGER_ROLE();
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, role));
        vm.prank(alice);
        vault.depositYield(ONE);
    }

    function test_RevertWhen_ZeroYield() public {
        vm.expectRevert(RWAVault.ZeroAmount.selector);
        vm.prank(admin);
        vault.depositYield(0);
    }

    function test_GrantedManagerCanDepositYield() public {
        bytes32 role = vault.YIELD_MANAGER_ROLE();
        vm.prank(admin);
        vault.grantRole(role, bob);
        vm.prank(bob);
        vault.depositYield(5 * ONE);
        assertEq(vault.totalAssets(), 5 * ONE);
    }

    function test_SupportsInterface() public view {
        assertTrue(vault.supportsInterface(type(IAccessControl).interfaceId));
        assertFalse(vault.supportsInterface(0xffffffff));
    }

    // ---------- security ----------

    /// First-depositor inflation attack: attacker deposits 1 wei then donates a large amount,
    /// hoping the victim's deposit rounds down. The decimals offset must protect the victim
    /// and make the donation a loss for the attacker.
    function test_InflationAttackIsUnprofitable() public {
        address attacker = makeAddr("attacker");
        _fund(attacker, 1_000 * ONE);

        vm.startPrank(attacker);
        vault.deposit(1, attacker);
        rwa.transfer(address(vault), 500 * ONE);
        vm.stopPrank();

        uint256 victimShares = _deposit(alice, 100 * ONE);
        assertGt(victimShares, 0);

        vm.prank(alice);
        uint256 victimOut = vault.redeem(victimShares, alice, alice);
        assertApproxEqRel(victimOut, 100 * ONE, 0.001e18); // victim loses < 0.1%

        uint256 attackerShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        uint256 attackerOut = vault.redeem(attackerShares, attacker, attacker);
        assertLt(attackerOut, 500 * ONE);
    }

    // ---------- fuzz ----------

    function testFuzz_DepositRedeemRoundTrip(uint256 assets) public {
        assets = bound(assets, 1, MAX_FUZZ);
        _fund(alice, assets);
        uint256 before = rwa.balanceOf(alice);
        uint256 shares = _deposit(alice, assets);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertLe(out, assets); // never get more than you put in
        assertApproxEqAbs(out, assets, 1);
        assertEq(rwa.balanceOf(alice), before - assets + out);
    }

    function testFuzz_MintWithdrawRoundTrip(uint256 shares) public {
        shares = bound(shares, OFFSET, MAX_FUZZ);
        uint256 need = vault.previewMint(shares);
        _fund(alice, need);
        vm.prank(alice);
        uint256 paid = vault.mint(shares, alice);
        assertEq(paid, need);
        uint256 max = vault.maxWithdraw(alice);
        assertLe(max, paid);
        vm.prank(alice);
        vault.withdraw(max, alice, alice);
    }

    function testFuzz_YieldNeverDecreasesSharePrice(uint256 depositAmt, uint256 yieldAmt) public {
        depositAmt = bound(depositAmt, 1, MAX_FUZZ);
        yieldAmt = bound(yieldAmt, 1, MAX_FUZZ);
        _fund(alice, depositAmt);
        _fund(admin, yieldAmt);
        _deposit(alice, depositAmt);
        uint256 unit = 10 ** vault.decimals();
        uint256 before = vault.convertToAssets(unit);
        _yield(yieldAmt);
        assertGe(vault.convertToAssets(unit), before);
    }
}
