import type { FetchRequest, FetchOptions, FetchResponse } from 'ohmyfetch'
import type { MatchedRoutes } from './utils'

// An interface to extend in a local project
export interface InternalApi { }

export type NitroFetchRequest = Exclude<keyof InternalApi, `/_${string}`|`/api/_${string}`> | Exclude<FetchRequest, string> | string & {}

export type MiddlewareOf<Route extends string> = Exclude<InternalApi[MatchedRoutes<Route>], Error | void>

export type TypedInternalResponse<Route, Default = unknown> =
  Default extends string | boolean | number | null | void | object
    // Allow user overrides
    ? Default
    : Route extends string
      ? MiddlewareOf<Route> extends never
        // Bail if only types are Error or void (for example, from middleware)
        ? Default
        : MiddlewareOf<Route>
      : Default

export interface $Fetch<DefaultT = unknown, DefaultR extends NitroFetchRequest = NitroFetchRequest> {
  <T = DefaultT, R extends NitroFetchRequest = DefaultR> (request: R, opts?: FetchOptions): Promise<TypedInternalResponse<R, T>>
  raw<T = DefaultT, R extends NitroFetchRequest = DefaultR> (request: R, opts?: FetchOptions): Promise<FetchResponse<TypedInternalResponse<R, T>>>
}

declare global {
  // eslint-disable-next-line no-var
  var $fetch: $Fetch
  namespace NodeJS {
    interface Global {
      $fetch: $Fetch
    }
  }
}

export { }
