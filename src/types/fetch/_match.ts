import type { InternalApi } from "./fetch";

type MatchResult<
  Key extends string,
  Exact extends boolean = false,
  Score extends any[] = [],
  catchAll extends boolean = false,
> = {
  [k in Key]: { key: k; exact: Exact; score: Score; catchAll: catchAll };
}[Key];

type Subtract<
  Minuend extends any[] = [],
  Subtrahend extends any[] = [],
> = Minuend extends [...Subtrahend, ...infer Remainder] ? Remainder : never;

type TupleIfDiff<
  First extends string,
  Second extends string,
  Tuple extends any[] = [],
> = First extends `${Second}${infer Diff}`
  ? Diff extends ""
    ? []
    : Tuple
  : [];

type MaxTuple<N extends any[] = [], T extends any[] = []> = {
  current: T;
  result: MaxTuple<N, ["", ...T]>;
}[[N["length"]] extends [Partial<T>["length"]] ? "current" : "result"];

type CalcMatchScore<
  Key extends string,
  Route extends string,
  Score extends any[] = [],
  Init extends boolean = false,
  FirstKeySegMatcher extends string = Init extends true ? ":Invalid:" : "",
> = `${Key}/` extends `${infer KeySeg}/${infer KeyRest}`
  ? KeySeg extends FirstKeySegMatcher // return score if `KeySeg` is empty string (except first pass)
    ? Subtract<
        [...Score, ...TupleIfDiff<Route, Key, ["", ""]>],
        TupleIfDiff<Key, Route, ["", ""]>
      >
    : `${Route}/` extends `${infer RouteSeg}/${infer RouteRest}`
      ? `${RouteSeg}?` extends `${infer RouteSegWithoutQuery}?${string}`
        ? RouteSegWithoutQuery extends KeySeg
          ? CalcMatchScore<KeyRest, RouteRest, [...Score, "", ""]> // exact match
          : KeySeg extends `:${string}`
            ? RouteSegWithoutQuery extends ""
              ? never
              : CalcMatchScore<KeyRest, RouteRest, [...Score, ""]> // param match
            : KeySeg extends RouteSegWithoutQuery
              ? CalcMatchScore<KeyRest, RouteRest, [...Score, ""]> // match by ${string}
              : never
        : never
      : never
  : never;

type _MatchedRoutes<
  Route extends string,
  MatchedKeys extends string = keyof InternalApi,
> = MatchedKeys extends any
  ? Route extends MatchedKeys
    ? MatchResult<MatchedKeys, true> // exact match
    : MatchedKeys extends `${infer Root}/**${string}`
      ? MatchedKeys extends `${string}/**`
        ? Route extends `${Root}/${string}`
          ? MatchResult<MatchedKeys, false, [], true>
          : never // catchAll match
        : MatchResult<MatchedKeys, false, CalcMatchScore<Root, Route, [], true>> // glob match
      : MatchResult<
          MatchedKeys,
          false,
          CalcMatchScore<MatchedKeys, Route, [], true>
        > // partial match
  : never;

export type MatchedRoutes<
  Route extends string,
  MatchedKeysResult extends MatchResult<string> = MatchResult<
    keyof InternalApi
  >,
  Matches extends MatchResult<string, boolean> = _MatchedRoutes<
    Route,
    MatchedKeysResult["key"]
  >,
> = Route extends "/"
  ? keyof InternalApi // root middleware
  : Extract<Matches, { exact: true }> extends never
    ?
        | Extract<
            Exclude<Matches, { score: never }>,
            { score: MaxTuple<Matches["score"]> }
          >["key"]
        | Extract<Matches, { catchAll: true }>["key"] // partial, glob and catchAll matches
    : Extract<Matches, { exact: true }>["key"]; // exact matches
