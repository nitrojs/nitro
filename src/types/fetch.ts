import type { EventHandler, RouterMethod } from "h3";
import type { FetchRequest, FetchOptions, FetchResponse } from "ofetch";
import type { MatchedRoutes } from "./utils";

// An interface to extend in a local project

export interface InternalApi {}
export interface InternalApiHandlers {}

export type NitroFetchRequest =
  | Exclude<keyof InternalApi, `/_${string}` | `/api/_${string}`>
  | Exclude<FetchRequest, string>
  // eslint-disable-next-line @typescript-eslint/ban-types
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

// Extracts the body or query parameter types expected for a route
// based on the types inferred from bodyValidator/queryValidator.
export type HandlerInputType<
  R extends NitroFetchRequest, 
  M extends AvailableRouterMethod<R>, 
  P extends "body" | "query"
> = 
  // TODO
  R extends string
    ? InternalApiHandlers[MatchedRoutes<R>][M] extends EventHandler<infer Request> 
      ? Request[P] 
      : any
    : any;

// Argumented fetch options to include the correct request methods,
// body types, and query parameter types.
// This overrides the default, which is only narrowed to a string.
export interface NitroFetchOptions<
  R extends NitroFetchRequest,
  M extends AvailableRouterMethod<R> = AvailableRouterMethod<R>,
> extends FetchOptions {
  method?: Uppercase<M> | M;
  body?: HandlerInputType<R, M, 'body'>;
  query?: HandlerInputType<R, M, 'query'>;
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

export interface $Fetch<
  DefaultT = unknown,
  DefaultR extends NitroFetchRequest = NitroFetchRequest,
> {
  <
    T = DefaultT,
    R extends NitroFetchRequest = DefaultR,
    O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
  >(
    request: R,
    opts?: O
  ): Promise<TypedInternalResponse<R, T, ExtractedRouteMethod<R, O>>>;
  raw<
    T = DefaultT,
    R extends NitroFetchRequest = DefaultR,
    O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
  >(
    request: R,
    opts?: O
  ): Promise<
    FetchResponse<TypedInternalResponse<R, T, ExtractedRouteMethod<R, O>>>
  >;
  create<T = DefaultT, R extends NitroFetchRequest = DefaultR>(
    defaults: FetchOptions
  ): $Fetch<T, R>;
}

declare global {
  // eslint-disable-next-line no-var
  var $fetch: $Fetch;
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      $fetch: $Fetch;
    }
  }
}

export {};
