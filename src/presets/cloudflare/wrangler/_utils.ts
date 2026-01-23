// Extracted from @types/yargs
type PascalCase<S extends string> = string extends S
  ? string
  : S extends `${infer T}-${infer U}`
    ? `${Capitalize<T>}${PascalCase<U>}`
    : Capitalize<S>;

type CamelCase<S extends string> = string extends S
  ? string
  : S extends `${infer T}-${infer U}`
    ? `${T}${PascalCase<U>}`
    : S;

export type CamelCaseKey<K extends PropertyKey> = K extends string ? Exclude<CamelCase<K>, ""> : K;
