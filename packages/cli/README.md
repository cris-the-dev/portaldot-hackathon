# @portalkit/cli

## `portalkit doctor`

Checks a network from `config/networks.json` before you deploy:

| Check | Fails when |
|---|---|
| Network config | required values are still `TODO` (e.g. Portaldot V3 today) |
| RPC reachable | `eth_blockNumber` fails |
| chainId matches config | `eth_chainId` ≠ configured chainId |
| Standard Ethereum JSON-RPC | any of `eth_chainId/gasPrice/getBalance/getTransactionCount/getBlockByNumber/call/estimateGas/getCode` fails |
| EIP-1559 & client info | warning only (`eth_feeHistory`, `eth_maxPriorityFeePerGas`, `net_version`, `web3_clientVersion`) |
| Deployer balance | balance of `--address` or `$PRIVATE_KEY` < `--min-balance` (default 0.1); skipped if neither is set |

```bash
portalkit doctor                         # anvil
portalkit doctor -n portaldot-v3 --json  # once V3 values are filled in
portalkit doctor -c ./my-networks.json -n my-chain -a 0x…
```

Exit code is `1` if any check fails. RPC URLs can be overridden with `PORTALKIT_RPC_URL_<KEY>`.

## `create-portalkit-app`

Coming in M3.
