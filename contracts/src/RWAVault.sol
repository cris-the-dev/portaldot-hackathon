// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title RWAVault
/// @notice ERC-4626 vault over a tokenized RWA. The issuer simulates real-world yield
///         (coupons, lease income…) by transferring extra assets in via `depositYield`,
///         which raises the share price for all holders. Demo/testnet only — not audited.
contract RWAVault is ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant YIELD_MANAGER_ROLE = keccak256("YIELD_MANAGER_ROLE");

    /// @dev Virtual share offset — makes first-depositor inflation attacks unprofitable.
    uint8 private constant DECIMALS_OFFSET = 6;

    event YieldDeposited(address indexed from, uint256 assets, uint256 totalAssetsAfter);

    error ZeroAddress();
    error ZeroAmount();

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address admin)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (admin == address(0) || address(asset_) == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(YIELD_MANAGER_ROLE, admin);
    }

    /// @notice Add yield to the vault without minting shares; increases assets per share.
    function depositYield(uint256 assets) external onlyRole(YIELD_MANAGER_ROLE) {
        if (assets == 0) revert ZeroAmount();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        emit YieldDeposited(msg.sender, assets, totalAssets());
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
