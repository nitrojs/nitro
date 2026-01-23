import type { InternalApi } from "./fetch.ts";

type MatchResult<Node, Path extends string, Exact extends boolean> = {
  node: Node;
  path: Path;
  exact: Exact;
};

type RouteMethods<Node> = Node extends { $: infer Methods } ? Methods : never;

type StripQuery<Route extends string> = Route extends `${infer Clean}?${string}`
  ? Clean
  : Route;

type StripHash<Route extends string> = Route extends `${infer Clean}#${string}`
  ? Clean
  : Route;

type StripLeadingSlash<Route extends string> = Route extends `/${infer Rest}`
  ? Rest
  : Route;

type StripTrailingSlash<Route extends string> = Route extends `${infer Rest}/`
  ? Rest
  : Route;

type NormalizePath<Route extends string> = StripTrailingSlash<
  StripLeadingSlash<StripHash<StripQuery<Route>>>
>;

type SplitPath<Route extends string> =
  Route extends `${infer Head}/${infer Tail}`
    ? [Head, ...SplitPath<Tail>]
    : Route extends ""
      ? []
      : [Route];

type JoinPath<Prefix extends string, Segment extends string> = Prefix extends ""
  ? `/${Segment}`
  : `${Prefix}/${Segment}`;

type RootPath<Prefix extends string> = Prefix extends "" ? "/" : Prefix;

type ParamKey<Routes> = Extract<keyof Routes, `:${string}`>;
type CatchAllKey<Routes> = Extract<keyof Routes, `**${string}`>;

type ExactMatch<
  Routes,
  Segments extends string[],
  Prefix extends string = "",
> = Segments extends [infer Head extends string, ...infer Tail extends string[]]
  ? Head extends keyof Routes
    ? ExactMatch<Routes[Head], Tail, JoinPath<Prefix, Head>>
    : never
  : Routes extends { $: any }
    ? MatchResult<Routes, RootPath<Prefix>, true>
    : never;

type LooseMatch<
  Routes,
  Segments extends string[],
  Prefix extends string = "",
  Fallback = never,
  CatchAll = never,
> = Routes extends object
  ? Segments extends [infer Head extends string, ...infer Tail extends string[]]
    ? LooseMatchStep<Routes, Head, Tail, Prefix, Fallback, CatchAll>
    :
        | (Routes extends { $: any }
            ? MatchResult<Routes, RootPath<Prefix>, false>
            : Fallback)
        | CatchAll
  : never;

type LooseMatchStep<
  Routes extends object,
  Head extends string,
  Tail extends string[],
  Prefix extends string,
  Fallback,
  CatchAll,
> = (
  Routes extends { $: any }
    ? MatchResult<Routes, RootPath<Prefix>, false>
    : Fallback
) extends infer NextFallback
  ? (
      CatchAllKey<Routes> extends never
        ? CatchAll
        :
            | CatchAll
            | MatchResult<
                Routes[CatchAllKey<Routes>],
                JoinPath<Prefix, CatchAllKey<Routes> & string>,
                false
              >
    ) extends infer NextCatchAll
    ? Head extends keyof Routes
      ? LooseMatch<
          Routes[Head],
          Tail,
          JoinPath<Prefix, Head>,
          NextFallback,
          NextCatchAll
        >
      : ParamKey<Routes> extends never
        ? CatchAllKey<Routes> extends never
          ? NextFallback | NextCatchAll
          :
              | MatchResult<
                  Routes[CatchAllKey<Routes>],
                  JoinPath<Prefix, CatchAllKey<Routes> & string>,
                  false
                >
              | NextCatchAll
              | NextFallback
        : LooseMatch<
            Routes[ParamKey<Routes>],
            Tail,
            JoinPath<Prefix, ParamKey<Routes> & string>,
            NextFallback,
            NextCatchAll
          >
    : never
  : never;

type MatchRoute<Route extends string> =
  ExactMatch<InternalApi, SplitPath<NormalizePath<Route>>> extends infer Exact
    ? [Exact] extends [never]
      ? LooseMatch<InternalApi, SplitPath<NormalizePath<Route>>>
      : Exact
    : never;

export type MatchedRouteMethods<Route extends string> =
  MatchRoute<Route> extends MatchResult<infer Node, any, any>
    ? RouteMethods<Node>
    : never;

export type MatchedRoutes<Route extends string> = MatchedRouteMethods<Route>;
