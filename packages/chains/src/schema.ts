import { z } from "zod";

/**
 * Placeholder for values that are not known yet (e.g. Portaldot V3 before its repo is public).
 * A network containing any TODO is loaded as "pending" and cannot be turned into a viem chain.
 */
export const TODO = "TODO" as const;
const todo = z.literal(TODO);

const orTodo = <T extends z.ZodType>(schema: T) => z.union([schema, todo]);

const url = z.url();
const decimals = z.number().int().min(0).max(36);

const common = {
  name: z.string().min(1),
  nativeSymbol: z.string().min(1),
  nativeDecimals: orTodo(decimals),
  ss58Prefix: orTodo(z.number().int().min(0).max(16383)).optional(),
  notes: z.string().optional(),
};

export const evmNetworkSchema = z.object({
  vm: z.literal("evm"),
  ...common,
  chainId: orTodo(z.number().int().positive()),
  rpcUrl: orTodo(url),
  wsUrl: orTodo(url).nullable().optional(),
  nativeName: z.string().min(1).optional(),
  explorer: orTodo(url).nullable(),
  /** Official faucet, if any. */
  faucetUrl: orTodo(url).nullable().optional(),
  testnet: z.boolean().optional(),
});

export const substrateNetworkSchema = z.object({
  vm: z.literal("substrate"),
  ...common,
  wsUrl: orTodo(url),
});

export const networkSchema = z.discriminatedUnion("vm", [evmNetworkSchema, substrateNetworkSchema]);

const NETWORK_KEY = /^[a-z0-9][a-z0-9-]*$/;

export const networksConfigSchema = z.record(z.string(), networkSchema).superRefine((config, ctx) => {
  for (const key of Object.keys(config)) {
    if (!NETWORK_KEY.test(key)) {
      ctx.addIssue({ code: "custom", path: [key], message: `network key "${key}" must be kebab-case` });
    }
  }
});

export type EvmNetworkConfig = z.infer<typeof evmNetworkSchema>;
export type SubstrateNetworkConfig = z.infer<typeof substrateNetworkSchema>;
export type NetworkConfig = z.infer<typeof networkSchema>;
export type NetworksConfig = z.infer<typeof networksConfigSchema>;
