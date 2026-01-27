/**
 * @link https://github.com/remix-run/remix/blob/2248669ed59fd716e267ea41df5d665d4781f4a9/packages/remix-server-runtime/serialize.ts
 */
type JsonPrimitive = string | number | boolean | string | number | boolean | null;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type NonJsonPrimitive = undefined | Function | symbol;

/*
 * `any` is the only type that can let you equate `0` with `1`
 * See https://stackoverflow.com/a/49928360/1490091
 */
type IsAny<T> = 0 extends 1 & T ? true : false;

type FilterKeys<TObj extends object, TFilter> = {
  [TKey in keyof TObj]: TObj[TKey] extends TFilter ? TKey : never;
}[keyof TObj];

// prettier-ignore
export type Serialize<T> = IsAny<T> extends true
  ? any
  : T extends JsonPrimitive | undefined
    ? T
    : T extends Map<any, any> | Set<any>
      ? Record<string, never>
      : T extends NonJsonPrimitive
        ? never
        : T extends { toJSON(): infer U }
          ? U
          : T extends []
            ? []
            : T extends [unknown, ...unknown[]]
              ? SerializeTuple<T>
              : T extends ReadonlyArray<infer U>
                ? (U extends NonJsonPrimitive ? null : Serialize<U>)[]
                : T extends object
                  ? SerializeObject<T>
                  : never;

/** JSON serialize [tuples](https://www.typescriptlang.org/docs/handbook/2/objects.html#tuple-types) */
export type SerializeTuple<T extends [unknown, ...unknown[]]> = {
  [k in keyof T]: T[k] extends NonJsonPrimitive ? null : Serialize<T[k]>;
};

/** JSON serialize objects (not including arrays) and classes */
export type SerializeObject<T extends object> = {
  [k in keyof Omit<T, FilterKeys<T, NonJsonPrimitive>>]: Serialize<T[k]>;
};

/**
 * @see https://github.com/ianstormtaylor/superstruct/blob/7973400cd04d8ad92bbdc2b6f35acbfb3c934079/src/utils.ts#L323-L325
 */
export type Simplify<TType> = TType extends any[] | Date
  ? TType
  : { [K in keyof TType]: Simplify<TType[K]> };
