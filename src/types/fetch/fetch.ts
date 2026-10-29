import type { RouterMethod } from "h3";
import type { FetchOptions, FetchRequest, FetchResponse } from "ofetch";
import type { MatchedRoutes } from "./_match";

// An interface to extend in a local project
export interface InternalApi {}

export type NitroFetchRequest =
  | Exclude<keyof InternalApi, `/_${string}` | `/api/_${string}`>
  | Exclude<FetchRequest, string>
  | (string & {});

export type MiddlewareOf<
  Route extends string,
  Method extends RouterMethod | "default",
> = Method extends keyof InternalApi[MatchedRoutes<Route>]
  ? InternalApi[MatchedRoutes<Route>][Method]
  : never;

export type TypedInternalResponse<
  Route,
  Default = unknown,
  Method extends RouterMethod = RouterMethod,
> = Default extends string | boolean | number | null | void | object
  ? // Allow user overrides
    Default
  : Route extends string
    ? MiddlewareOf<Route, Method> extends never
      ? MiddlewareOf<Route, "default"> extends never
        ? // Bail if only types are Error or void (for example, from middleware)
          Default
        : MiddlewareOf<Route, "default">
      : MiddlewareOf<Route, Method>
    : Default;

// Extracts the available http methods based on the route.
// Defaults to all methods if there aren't any methods available or if there is a catch-all route.
export type AvailableRouterMethod<R extends NitroFetchRequest> =
  R extends string
    ? keyof InternalApi[MatchedRoutes<R>] extends undefined
      ? RouterMethod
      : Extract<
            keyof InternalApi[MatchedRoutes<R>],
            "default"
          > extends undefined
        ? Extract<RouterMethod, keyof InternalApi[MatchedRoutes<R>]>
        : RouterMethod
    : RouterMethod;

// Argumented fetch options to include the correct request methods.
// This overrides the default, which is only narrowed to a string.
export interface NitroFetchOptions<
  R extends NitroFetchRequest,
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends FetchOptions {
  method?: Uppercase<M> | M;
}

// Extract the route method from options which might be undefined or without a method parameter.
export type ExtractedRouteMethod<
  R extends NitroFetchRequest,
  O extends NitroFetchOptions<R>,
> = O extends undefined
  ? "get"
  : Lowercase<Exclude<O["method"], undefined>> extends RouterMethod
    ? Lowercase<Exclude<O["method"], undefined>>
    : "get";

export type Base$Fetch<
  DefaultT = unknown,
  DefaultR extends NitroFetchRequest = NitroFetchRequest,
> = <
  T = DefaultT,
  R extends NitroFetchRequest = DefaultR,
  O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
>(
  request: R,
  opts?: O
) => Promise<
  TypedInternalResponse<
    R,
    T,
    NitroFetchOptions<R> extends O ? "get" : ExtractedRouteMethod<R, O>
  >
>;

export interface $Fetch<
  DefaultT = unknown,
  DefaultR extends NitroFetchRequest = NitroFetchRequest,
> extends Base$Fetch<DefaultT, DefaultR> {
  raw<
    T = DefaultT,
    R extends NitroFetchRequest = DefaultR,
    O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
  >(
    request: R,
    opts?: O
  ): Promise<
    FetchResponse<
      TypedInternalResponse<
        R,
        T,
        NitroFetchOptions<R> extends O ? "get" : ExtractedRouteMethod<R, O>
      >
    >
  >;
  create<T = DefaultT, R extends NitroFetchRequest = DefaultR>(
    defaults: FetchOptions
  ): $Fetch<T, R>;
}

declare global {
  var $fetch: $Fetch;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      $fetch: $Fetch;
    }
  }
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
