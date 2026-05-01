export type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

export type IntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

export type ExcludeFunctions<G extends Record<string, any>> = Pick<
  G,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  { [P in keyof G]: NonNullable<G[P]> extends Function ? never : P }[keyof G]
>;

export type KebabCase<T extends string, A extends string = ""> = T extends `${infer F}${infer R}`
  ? KebabCase<R, `${A}${F extends Lowercase<F> ? "" : "-"}${Lowercase<F>}`>
  : A;
