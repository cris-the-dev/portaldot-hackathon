"use client";

import { connectSubstrate, getNativeAccount, getNativeChainInfo, type NativeAccountInfo, type NativeChainInfo } from "@portalkit/address";
import { TODO, getNetwork, type SubstrateNetworkConfig } from "@portalkit/chains";
import { useQuery } from "@tanstack/react-query";
import { networkStatuses } from "./wagmi";

/** Native (Substrate) networks from config/networks.json whose wsUrl is known. */
export const substrateNetworks: (SubstrateNetworkConfig & { key: string })[] = networkStatuses.flatMap((n) => {
  const net = getNetwork(n.key, { env: {} });
  return net.vm === "substrate" && net.wsUrl !== TODO ? [{ ...net, key: n.key }] : [];
});

async function withRpc<T>(wsUrl: string, fn: (rpc: Awaited<ReturnType<typeof connectSubstrate>>) => Promise<T>): Promise<T> {
  const rpc = await connectSubstrate(wsUrl, { timeoutMs: 8_000 });
  try {
    return await fn(rpc);
  } finally {
    rpc.close();
  }
}

export function useNativeChainInfo(net: SubstrateNetworkConfig) {
  return useQuery<NativeChainInfo>({
    queryKey: ["native-chain", net.wsUrl],
    queryFn: () => withRpc(net.wsUrl as string, getNativeChainInfo),
    retry: false,
    staleTime: 60_000,
  });
}

export function useNativeAccount(net: SubstrateNetworkConfig, ss58: string | undefined) {
  return useQuery<NativeAccountInfo>({
    queryKey: ["native-account", net.wsUrl, ss58],
    enabled: Boolean(ss58),
    queryFn: () => withRpc(net.wsUrl as string, (rpc) => getNativeAccount(rpc, ss58 as string)),
    retry: false,
  });
}
