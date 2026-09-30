import type { Address } from "viem";

/**
 * How an EVM account (H160) relates to a Substrate account (AccountId32 / SS58) on a given chain.
 *
 * Substrate EVM designs differ (Frontier's hashed "evm:" mapping, padded/truncated ids, unified
 * accounts via a precompile/pallet, ...) and some are one-way. Portaldot V3's mechanism is not
 * public yet, so the concrete strategy is pluggable. A strategy that cannot map in one direction
 * throws `MappingNotAvailableError` from that method.
 */
export interface AddressMappingStrategy {
  /** Stable identifier, e.g. "pending-v3". */
  readonly id: string;
  /** Human-readable summary, shown in the dashboard converter. */
  readonly description: string;
  /** Map an EVM address to the SS58 address (encoded with `ss58Prefix`) that owns its funds. */
  evmToSubstrate(h160: Address, ss58Prefix: number): string;
  /** Map an SS58 address to the EVM address it controls. */
  substrateToEvm(ss58: string): Address;
}

export class MappingNotAvailableError extends Error {
  override name = "MappingNotAvailableError";
  constructor(
    readonly strategyId: string,
    message: string,
  ) {
    super(message);
  }
}

export const PENDING_V3_STRATEGY_ID = "pending-v3";

const PENDING_MESSAGE =
  "The H160 <-> SS58 account mapping for Portaldot V3 is not public yet. " +
  "Implement and register the real strategy once V3 is released (see docs/v3-findings.md, item 4).";

/**
 * Placeholder until Portaldot V3 publishes its account mapping.
 * TODO(v3): replace with the real strategy and add official test vectors.
 */
export const pendingV3Strategy: AddressMappingStrategy = {
  id: PENDING_V3_STRATEGY_ID,
  description: "Portaldot V3 account mapping — not published yet",
  evmToSubstrate() {
    throw new MappingNotAvailableError(PENDING_V3_STRATEGY_ID, PENDING_MESSAGE);
  },
  substrateToEvm() {
    throw new MappingNotAvailableError(PENDING_V3_STRATEGY_ID, PENDING_MESSAGE);
  },
};

export class UnknownStrategyError extends Error {
  override name = "UnknownStrategyError";
}

/** Registry of mapping strategies, so apps can swap the mapping without code changes elsewhere. */
export class StrategyRegistry {
  readonly #strategies = new Map<string, AddressMappingStrategy>();

  constructor(initial: readonly AddressMappingStrategy[] = [pendingV3Strategy]) {
    for (const strategy of initial) this.register(strategy);
  }

  register(strategy: AddressMappingStrategy, { replace = false }: { replace?: boolean } = {}): void {
    if (!replace && this.#strategies.has(strategy.id)) {
      throw new Error(`Strategy "${strategy.id}" is already registered (pass { replace: true } to override).`);
    }
    this.#strategies.set(strategy.id, strategy);
  }

  get(id: string): AddressMappingStrategy {
    const strategy = this.#strategies.get(id);
    if (!strategy) {
      throw new UnknownStrategyError(`Unknown mapping strategy "${id}". Registered: ${this.ids().join(", ")}`);
    }
    return strategy;
  }

  has(id: string): boolean {
    return this.#strategies.has(id);
  }

  ids(): string[] {
    return [...this.#strategies.keys()];
  }

  list(): AddressMappingStrategy[] {
    return [...this.#strategies.values()];
  }
}

/** Shared default registry. */
export const strategies = new StrategyRegistry();
