// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MockRWA} from "../src/MockRWA.sol";

contract MockRWATest is Test {
    MockRWA internal rwa;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        rwa = new MockRWA("Tokenized Gold", "tGOLD", admin);
    }

    function test_Metadata() public view {
        assertEq(rwa.name(), "Tokenized Gold");
        assertEq(rwa.symbol(), "tGOLD");
        assertEq(rwa.decimals(), 18);
        assertEq(rwa.totalSupply(), 0);
    }

    function test_ConstructorGrantsRoles() public view {
        assertTrue(rwa.hasRole(rwa.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(rwa.hasRole(rwa.ISSUER_ROLE(), admin));
        assertFalse(rwa.hasRole(rwa.ISSUER_ROLE(), alice));
        assertEq(rwa.getRoleAdmin(rwa.ISSUER_ROLE()), rwa.DEFAULT_ADMIN_ROLE());
    }

    function test_RevertWhen_AdminIsZero() public {
        vm.expectRevert(MockRWA.ZeroAddress.selector);
        new MockRWA("X", "X", address(0));
    }

    function testFuzz_IssuerCanMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.prank(admin);
        rwa.mint(to, amount);
        assertEq(rwa.balanceOf(to), amount);
        assertEq(rwa.totalSupply(), amount);
    }

    function test_RevertWhen_NonIssuerMints() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, rwa.ISSUER_ROLE())
        );
        vm.prank(alice);
        rwa.mint(alice, 1e18);
    }

    function test_RevertWhen_MintToZero() public {
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InvalidReceiver.selector, address(0)));
        vm.prank(admin);
        rwa.mint(address(0), 1);
    }

    function test_GrantedIssuerCanMint_RevokedCannot() public {
        bytes32 issuer = rwa.ISSUER_ROLE();
        vm.prank(admin);
        rwa.grantRole(issuer, alice);
        vm.prank(alice);
        rwa.mint(bob, 5e18);
        assertEq(rwa.balanceOf(bob), 5e18);

        vm.prank(admin);
        rwa.revokeRole(issuer, alice);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, issuer));
        vm.prank(alice);
        rwa.mint(bob, 1);
    }

    function test_RenounceRole() public {
        bytes32 issuer = rwa.ISSUER_ROLE();
        vm.prank(admin);
        rwa.renounceRole(issuer, admin);
        assertFalse(rwa.hasRole(issuer, admin));
    }

    function test_RevertWhen_NonAdminGrantsRole() public {
        bytes32 issuer = rwa.ISSUER_ROLE();
        bytes32 adminRole = rwa.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, adminRole)
        );
        vm.prank(alice);
        rwa.grantRole(issuer, alice);
    }

    function test_TransferApproveTransferFrom() public {
        vm.prank(admin);
        rwa.mint(alice, 10e18);

        vm.prank(alice);
        assertTrue(rwa.transfer(bob, 3e18));
        assertEq(rwa.balanceOf(bob), 3e18);

        vm.prank(alice);
        assertTrue(rwa.approve(bob, 2e18));
        assertEq(rwa.allowance(alice, bob), 2e18);

        vm.prank(bob);
        assertTrue(rwa.transferFrom(alice, bob, 2e18));
        assertEq(rwa.balanceOf(alice), 5e18);
        assertEq(rwa.balanceOf(bob), 5e18);
        assertEq(rwa.allowance(alice, bob), 0);
    }

    function test_Burn() public {
        vm.prank(admin);
        rwa.mint(alice, 10e18);
        vm.prank(alice);
        rwa.burn(4e18);
        assertEq(rwa.balanceOf(alice), 6e18);
        assertEq(rwa.totalSupply(), 6e18);
    }

    function test_BurnFrom() public {
        vm.prank(admin);
        rwa.mint(alice, 10e18);
        vm.prank(alice);
        rwa.approve(bob, 4e18);
        vm.prank(bob);
        rwa.burnFrom(alice, 4e18);
        assertEq(rwa.balanceOf(alice), 6e18);
        assertEq(rwa.allowance(alice, bob), 0);
    }

    function test_RevertWhen_BurnFromWithoutAllowance() public {
        vm.prank(admin);
        rwa.mint(alice, 1e18);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, bob, 0, 1e18));
        vm.prank(bob);
        rwa.burnFrom(alice, 1e18);
    }

    function test_SupportsInterface() public view {
        assertTrue(rwa.supportsInterface(type(IAccessControl).interfaceId));
        assertTrue(rwa.supportsInterface(0x01ffc9a7)); // ERC-165
        assertFalse(rwa.supportsInterface(0xffffffff));
    }
}
