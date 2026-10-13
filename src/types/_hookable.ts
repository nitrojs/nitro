import type { NestedHooks } from "hookable";

// Structural types of `hookable` instances. `hookable` is bundled, and its classes have
// private members, so inlined copies of the class types would not be assignable to each other.

type HookCallback = (...args: any) => Promise<void> | void;

type HookKeys<T> = keyof T & string;

type InferCallback<HooksT, NameT extends keyof HooksT> = HooksT[NameT] extends HookCallback
  ? HooksT[NameT]
  : never;

type DeprecatedHook<HooksT> = { message?: string; to: HookKeys<HooksT> };

type HookEvent<HooksT> = {
  [NameT in keyof HooksT]: {
    name: NameT;
    args: Parameters<InferCallback<HooksT, NameT>>;
    context: Record<string, any>;
  };
}[keyof HooksT];

/**
 * Minimal hook system (`HookableCore` from `hookable`).
 *
 * @see https://github.com/unjs/hookable
 */
export interface HookableCore<HooksT extends Record<string, any>> {
  hook<NameT extends HookKeys<HooksT>>(name: NameT, fn: InferCallback<HooksT, NameT>): () => void;
  removeHook<NameT extends HookKeys<HooksT>>(name: NameT, fn: InferCallback<HooksT, NameT>): void;
  callHook<NameT extends HookKeys<HooksT>>(
    name: NameT,
    ...args: Parameters<InferCallback<HooksT, NameT>>
  ): Promise<any> | void;
}

/**
 * Hook system (`Hookable` from `hookable`).
 *
 * @see https://github.com/unjs/hookable
 */
export interface Hookable<HooksT extends Record<string, any>> extends HookableCore<HooksT> {
  hook<NameT extends HookKeys<HooksT>>(
    name: NameT,
    fn: InferCallback<HooksT, NameT>,
    options?: { allowDeprecated?: boolean }
  ): () => void;
  hookOnce<NameT extends HookKeys<HooksT>>(
    name: NameT,
    fn: InferCallback<HooksT, NameT>
  ): () => void;
  clearHook<NameT extends HookKeys<HooksT>>(name: NameT): void;
  deprecateHook<NameT extends HookKeys<HooksT>>(
    name: NameT,
    deprecated: HookKeys<HooksT> | DeprecatedHook<HooksT>
  ): void;
  deprecateHooks(deprecatedHooks: Partial<Record<HookKeys<HooksT>, DeprecatedHook<HooksT>>>): void;
  addHooks(configHooks: NestedHooks<HooksT>): () => void;
  removeHooks(configHooks: NestedHooks<HooksT>): void;
  removeAllHooks(): void;
  callHookParallel<NameT extends HookKeys<HooksT>>(
    name: NameT,
    ...args: Parameters<InferCallback<HooksT, NameT>>
  ): Promise<any[]> | void;
  callHookWith<
    NameT extends HookKeys<HooksT>,
    CallFunction extends (
      hooks: HookCallback[],
      args: Parameters<InferCallback<HooksT, NameT>>,
      name: NameT
    ) => any,
  >(
    caller: CallFunction,
    name: NameT,
    args: Parameters<InferCallback<HooksT, NameT>>
  ): ReturnType<CallFunction>;
  beforeEach(fn: (event: HookEvent<HooksT>) => void): () => void;
  afterEach(fn: (event: HookEvent<HooksT>) => void): () => void;
}
