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

// Keys of the highest scoring matches: those no score in `Scores` is longer than.
// Matches are not compared against a highest score built up front, because building
// it recurses without end while the route is still generic.
type MaxScoreKeys<Matches, Scores> = Matches extends {
  key: infer Key;
  score: infer Score extends any[];
}
  ? [Extract<Scores, [...Score, any, ...any[]]>] extends [never]
    ? Key
    : never
  : never;

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
  MatchedResultUnion extends MatchResult<string> = MatchResult<
    keyof InternalApi
  >,
> = MatchedResultUnion["key"] extends infer MatchedKeys // spread union type
  ? MatchedKeys extends string
    ? Route extends MatchedKeys
      ? MatchResult<MatchedKeys, true> // exact match
      : MatchedKeys extends `${infer Root}/**${string}`
        ? MatchedKeys extends `${string}/**`
          ? Route extends `${Root}/${string}`
            ? MatchResult<MatchedKeys, false, [], true>
            : never // catchAll match
          : MatchResult<
              MatchedKeys,
              false,
              CalcMatchScore<Root, Route, [], true>
            > // glob match
        : MatchResult<
            MatchedKeys,
            false,
            CalcMatchScore<MatchedKeys, Route, [], true>
          > // partial match
    : never
  : never;

export type MatchedRoutes<
  Route extends string,
  MatchedKeysResult extends MatchResult<string> = MatchResult<
    keyof InternalApi
  >,
  Matches extends MatchResult<string> = _MatchedRoutes<
    Route,
    MatchedKeysResult
  >,
> = Route extends "/"
  ? keyof InternalApi // root middleware
  : Extract<Matches, { exact: true }> extends never
    ? | MaxScoreKeys<Exclude<Matches, { score: never }>, Matches["score"]>
      | Extract<Matches, { catchAll: true }>["key"] // partial, glob and catchAll matches
    : Extract<Matches, { exact: true }>["key"]; // exact matches
