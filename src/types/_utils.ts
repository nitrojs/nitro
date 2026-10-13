declare const invalidValue: unique symbol;

/** Uninhabited, so a rejected value reports `Message` in its type error. */
export type Invalid<Message extends string> = Message & { readonly [invalidValue]: never };

type LibOptionName = "lib" | `${string}Lib`;

type LibOption = null | Invalid<"Library imports are not JSON-serializable; nitro injects them for installed driver dependencies (set `null` to opt out)">;

type JsonPrimitive = string | number | boolean | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type NonSerializable =
  | Function
  | symbol
  | bigint
  | RegExp
  | Date
  | Error
  | Promise<any>
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | ArrayBufferLike
  | ArrayBufferView;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6];

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * The subset of `T` that survives `JSON.stringify`, with anything else mapped to {@link Invalid}.
 *
 * `Depth` bounds instantiation for large and self-referential option types; deeper values are
 * passed through unchecked.
 */
export type Serializable<T, Depth extends number = 6> = [Depth] extends [never]
  ? T
  : T extends JsonPrimitive
    ? T
    : T extends NonSerializable
      ? Invalid<"nitro serializes options with JSON.stringify; this value would not survive">
      : T extends readonly (infer U)[]
        ? Array<Serializable<U, Prev[Depth]>>
        : T extends object
          ? { [K in keyof T]: Serializable<T[K], Prev[Depth]> }
          : T;

/** Driver or connector options, as serialized into the build output. */
export type SerializableOptions<T> = {
  [K in keyof T]: K extends LibOptionName ? LibOption : Serializable<T[K]>;
};

/**
 * `T` from an optional dependency, or `Fallback` when it is not installed.
 *
 * Built types import optional dependencies with `@ts-ignore` (see `build.config.ts`), so a missing
 * one resolves to an error type (`any`), which the tuple check detects without collapsing to `any`.
 */
export type OptionalDepType<T, Fallback> = [0] extends [1 & T] ? Fallback : T;

export type KebabCase<T extends string, A extends string = ""> = T extends `${infer F}${infer R}`
  ? KebabCase<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;
