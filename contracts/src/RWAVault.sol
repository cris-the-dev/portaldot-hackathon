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
///         which raises the share price for all holders.
///
///         Optional compliance (simulated KYC): when `kycRequired` is on, only verified accounts
///         can receive shares (deposits, mints and share transfers). Withdrawals always work so a
///         de-verified holder can still exit. Demo/testnet only — not audited.
contract RWAVault is ERC4626, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant YIELD_MANAGER_ROLE = keccak256("YIELD_MANAGER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    /// @notice When true, only `isVerified` accounts may receive shares.
    bool public kycRequired;
    /// @notice Simulated KYC status per account.
    mapping(address account => bool) public isVerified;

    /// @dev Virtual share offset — makes first-depositor inflation attacks unprofitable.
    uint8 private constant DECIMALS_OFFSET = 6;

    event YieldDeposited(address indexed from, uint256 assets, uint256 totalAssetsAfter);
    event KycRequirementUpdated(bool required);
    event VerificationUpdated(address indexed account, bool verified);

    error ZeroAddress();
    error ZeroAmount();
    error NotVerified(address account);

    constructor(IERC20 asset_, string memory name_, string memory symbol_, address admin)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (admin == address(0) || address(asset_) == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(YIELD_MANAGER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
    }

    /// @notice Add yield to the vault without minting shares; increases assets per share.
    function depositYield(uint256 assets) external onlyRole(YIELD_MANAGER_ROLE) {
        if (assets == 0) revert ZeroAmount();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);
        emit YieldDeposited(msg.sender, assets, totalAssets());
    }

    // ---------- compliance ----------

    /// @notice Turn the KYC requirement on or off.
    function setKycRequired(bool required) external onlyRole(COMPLIANCE_ROLE) {
        kycRequired = required;
        emit KycRequirementUpdated(required);
    }

    /// @notice Set the KYC status of one account.
    function setVerified(address account, bool verified) public onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        isVerified[account] = verified;
        emit VerificationUpdated(account, verified);
    }

    /// @notice Set the KYC status of many accounts.
    function setVerifiedBatch(address[] calldata accounts, bool verified) external {
        for (uint256 i; i < accounts.length; ++i) {
            setVerified(accounts[i], verified);
        }
    }

    /// @notice True if `account` may currently receive shares.
    function canReceiveShares(address account) public view returns (bool) {
        return !kycRequired || isVerified[account];
    }

    /// @dev ERC-4626-conformant gating: unverified receivers have a max of 0, so deposit/mint revert
    ///      with ERC4626ExceededMaxDeposit/Mint and integrators can check eligibility up front.
    function maxDeposit(address receiver) public view override returns (uint256) {
        return canReceiveShares(receiver) ? super.maxDeposit(receiver) : 0;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return canReceiveShares(receiver) ? super.maxMint(receiver) : 0;
    }

    /// @dev Share movements into an account (mint or transfer) require verification; burns don't,
    ///      so withdrawals are never blocked.
    function _update(address from, address to, uint256 value) internal override {
        if (to != address(0) && !canReceiveShares(to)) revert NotVerified(to);
        super._update(from, to, value);
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }
}
