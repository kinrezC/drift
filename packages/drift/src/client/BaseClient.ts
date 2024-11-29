import type { Abi } from "abitype";
import { OxAdapter, type OxAdapterConfig } from "src/adapter/OxAdapter";
import type { Address, Bytes, Hash } from "src/adapter/types/Abi";
import type {
  Adapter,
  DecodeFunctionDataParams,
  EncodeFunctionDataParams,
  GetEventsParams,
  ReadAdapter,
  ReadParams,
  ReadWriteAdapter,
  SimulateWriteParams,
  WriteParams,
} from "src/adapter/types/Adapter";
import type { Block } from "src/adapter/types/Block";
import type { EventLog, EventName } from "src/adapter/types/Event";
import type {
  DecodedFunctionData,
  FunctionName,
  FunctionReturn,
} from "src/adapter/types/Function";
import type {
  GetBalanceParams,
  GetBlockParams,
  GetTransactionParams,
  WaitForTransactionParams,
} from "src/adapter/types/Network";
import type {
  Transaction,
  TransactionReceipt,
} from "src/adapter/types/Transaction";
import { ClientCache } from "src/cache/ClientCache";
import {
  LruSimpleCache,
  type LruSimpleCacheConfig,
} from "src/cache/LruSimpleCache";
import type { SimpleCache } from "src/cache/types";
import { DriftError } from "src/error/DriftError";
import type { SerializableKey } from "src/utils/createSerializableKey";
import type { OneOf, Pretty } from "src/utils/types";

export type ClientConfig<
  TAdapter extends Adapter = Adapter,
  TCache extends SimpleCache = SimpleCache,
> = Pretty<ClientOptions<TCache> & ClientAdapterOptions<TAdapter>>;

/**
 * A client for interacting with a network through an adapter and cache.
 *
 * This class is not intended for direct use in apps, but rather as a base class
 * for other clients.
 */
export class BaseClient<
  TAdapter extends Adapter = Adapter,
  TCache extends SimpleCache = SimpleCache,
> {
  adapter: TAdapter;
  cache: ClientCache<TCache>;
  private _chainId?: number;

  constructor({
    adapter,
    cache,
    chainId,
    ...adapterConfig
  }: ClientConfig<TAdapter, TCache> = {}) {
    this.adapter =
      adapter ?? (new OxAdapter(adapterConfig) as Adapter as TAdapter);

    let store: TCache;
    if (cache && "clear" in cache) {
      store = cache;
    } else {
      store = new LruSimpleCache({
        ...cache,
        max: cache?.max ?? 500,
      }) as SimpleCache as TCache;
    }

    this.cache = new ClientCache({
      store,
      namespace: this.getChainId.bind(this),
    });

    this._chainId = chainId;
  }

  isReadWrite(): this is BaseClient<ReadWriteAdapter, TCache> {
    return typeof this.adapter.write === "function";
  }

  /**
   * Get the chain ID of the network.
   */
  async getChainId(): Promise<number> {
    this._chainId ??= await this.adapter.getChainId();
    return this._chainId;
  }

  /**
   * Get the current block number.
   */
  async getBlockNumber(): Promise<bigint> {
    return this.adapter.getBlockNumber();
  }

  /**
   * Get a block from a block tag, number, or hash. If no argument is provided,
   * the latest block is returned.
   */
  async getBlock(params?: GetBlockParams): Promise<Block | undefined> {
    return this._cachedFn({
      key: await this.cache.blockKey(params),
      fn: () => this.adapter.getBlock(params),
    });
  }

  /**
   * Get the balance of native currency for an account.
   */
  async getBalance(params: GetBalanceParams): Promise<bigint> {
    return this._cachedFn({
      key: await this.cache.balanceKey(params),
      fn: () => this.adapter.getBalance(params),
    });
  }

  /**
   * Get a transaction from a transaction hash.
   */
  async getTransaction(
    params: GetTransactionParams,
  ): Promise<Transaction | undefined> {
    return this._cachedFn({
      key: await this.cache.transactionKey(params),
      fn: () => this.adapter.getTransaction(params),
    });
  }

  /**
   * Wait for a transaction to be mined and get the transaction receipt.
   */
  async waitForTransaction(
    params: WaitForTransactionParams,
  ): Promise<TransactionReceipt | undefined> {
    return this._cachedFn({
      key: await this.cache.transactionReceiptKey(params),
      fn: () => this.adapter.waitForTransaction(params),
    });
  }

  /**
   * Encodes a function call into calldata.
   */
  encodeFunctionData<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi>,
  >(params: EncodeFunctionDataParams<TAbi, TFunctionName>): Bytes {
    return this.adapter.encodeFunctionData(params);
  }

  /**
   * Decodes a string of function calldata into it's arguments and function
   * name.
   */
  decodeFunctionData<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi> = FunctionName<TAbi>,
  >(
    params: DecodeFunctionDataParams<TAbi, TFunctionName>,
  ): DecodedFunctionData<TAbi, TFunctionName> {
    return this.adapter.decodeFunctionData(params);
  }

  /**
   * Retrieves specified events from a contract.
   */
  async getEvents<TAbi extends Abi, TEventName extends EventName<TAbi>>(
    params: GetEventsParams<TAbi, TEventName>,
  ): Promise<EventLog<TAbi, TEventName>[]> {
    return this._cachedFn({
      key: await this.cache.eventsKey(params),
      fn: () => this.adapter.getEvents(params),
    });
  }

  /**
   * Reads a specified function from a contract.
   */
  async read<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "pure" | "view">,
  >(
    params: ReadParams<TAbi, TFunctionName>,
  ): Promise<FunctionReturn<TAbi, TFunctionName>> {
    return this._cachedFn({
      key: await this.cache.readKey(params),
      fn: () => this.adapter.read(params),
    });
  }

  /**
   * Simulates a write operation on a specified function of a contract.
   */
  async simulateWrite<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(
    params: SimulateWriteParams<TAbi, TFunctionName>,
  ): Promise<FunctionReturn<TAbi, TFunctionName>> {
    return this.adapter.simulateWrite(params);
  }

  /**
   * Writes to a specified function on a contract.
   * @returns The transaction hash of the submitted transaction.
   * @throws A {@linkcode ReadonlyError} if not connected to a signer.
   */
  write<
    TAbi extends Abi,
    TFunctionName extends FunctionName<TAbi, "nonpayable" | "payable">,
  >(
    ...[params]: TAdapter extends ReadWriteAdapter
      ? [params: WriteParams<TAbi, TFunctionName>]
      : never
  ): TAdapter extends ReadWriteAdapter ? Promise<Hash> : never {
    if (!this.isReadWrite()) {
      throw new ReadonlyError();
    }
    return this.adapter.write(params) as Promise<Hash> as any;
  }

  /**
   * Get the address of the signer for this instance.
   * @throws A {@linkcode ReadonlyError} if not connected to a signer.
   */
  getSignerAddress(
    ..._: TAdapter extends ReadWriteAdapter ? [] : never
  ): TAdapter extends ReadWriteAdapter ? Promise<Address> : never {
    if (!this.isReadWrite()) {
      throw new ReadonlyError();
    }
    return this.adapter.getSignerAddress() as Promise<Address> as any;
  }

  /**
   * Checks the cache for the key and returns the value if found, otherwise
   * executes the function and stores the result in the cache.
   */
  private async _cachedFn<T extends (...args: any[]) => any>({
    key,
    fn,
  }: {
    key: SerializableKey;
    fn: T;
  }): Promise<Awaited<ReturnType<T>>> {
    if (await this.cache.has(key)) {
      return this.cache.get(key) as Awaited<ReturnType<T>>;
    }
    const value = await fn();
    return this.cache.set(key, value).then(() => value);
  }
}

export type ReadClient<
  TAdapter extends ReadAdapter = ReadAdapter,
  TCache extends SimpleCache = SimpleCache,
> = BaseClient<TAdapter, TCache>;

export type ReadWriteClient<
  TAdapter extends ReadWriteAdapter = ReadWriteAdapter,
  TCache extends SimpleCache = SimpleCache,
> = BaseClient<TAdapter, TCache>;

/**
 * A union of options for configuring the adapter used by a Drift client.
 */
export type ClientAdapterOptions<T extends Adapter = Adapter> = OneOf<
  | {
      adapter?: T;
    }
  | OxAdapterConfig
>;

export interface ClientOptions<TCache extends SimpleCache = SimpleCache> {
  cache?: TCache | LruSimpleCacheConfig;
  chainId?: number;
}

/**
 * An error thrown by a Drift client.
 */
export class ClientError extends DriftError {}

/**
 * An error thrown when attempting to perform a write operation with a
 * read-only adapter.
 *
 * @see {@linkcode ReadAdapter} and {@linkcode ReadWriteAdapter}
 */
export class ReadonlyError extends ClientError {
  constructor() {
    super("Adapter does not support write operations.");
  }
}