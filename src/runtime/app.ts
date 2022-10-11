import { App as H3App, createApp, createRouter, eventHandler, lazyEventHandler, Router, sendRedirect, setHeaders } from 'h3'
import { createFetch, Headers } from 'ohmyfetch'
import destr from 'destr'
import { createRouter as createMatcher } from 'radix3'
import { createCall, createFetch as createLocalFetch } from 'unenv/runtime/fetch/index'
import { createHooks, Hookable } from 'hookable'
import { useRuntimeConfig } from './config'
import { timingMiddleware } from './timing'
import { cachedEventHandler } from './cache'
import { plugins } from '#internal/nitro/virtual/plugins'
import errorHandler from '#internal/nitro/virtual/error-handler'
import { handlers } from '#internal/nitro/virtual/server-handlers'

export interface NitroApp {
  h3App: H3App
  router: Router
  // TODO: Type hooks and allow extending
  hooks: Hookable
  localCall: ReturnType<typeof createCall>
  localFetch: ReturnType<typeof createLocalFetch>
}

function createNitroApp (): NitroApp {
  const config = useRuntimeConfig()

  const hooks = createHooks()

  const h3App = createApp({
    debug: destr(process.env.DEBUG),
    onError: errorHandler
  })

  h3App.use(config.app.baseURL, timingMiddleware)

  const router = createRouter()

  const routerOptions = createMatcher({ routes: config.nitro.routes })

  h3App.use(eventHandler((event) => {
    const routeOptions = routerOptions.lookup(event.req.url) || {}
    // Share applicable route rules across handlers
    event.context.routeOptions = routeOptions
    if (routeOptions.cors) {
      setHeaders(event, {
        'access-control-allow-origin': '*',
        'access-control-allowed-methods': '*',
        'access-control-allow-headers': '*',
        'access-control-max-age': '0'
      })
    }
    if (routeOptions.headers) {
      setHeaders(event, routeOptions.headers)
    }
    if (routeOptions.redirect) {
      return sendRedirect(event, routeOptions.redirect.to || routeOptions.redirect, routeOptions.redirect.statusCode || 307)
    }
  }))

  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler

    const referenceRoute = h.route.replace(/:\w+|\*\*/g, '_')
    const routeOptions = routerOptions.lookup(referenceRoute) || {}
    if (routeOptions.swr) {
      handler = cachedEventHandler(handler, {
        group: 'nitro/routes'
      })
    }

    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || '/')).replace(/\/+/g, '/')
      h3App.use(middlewareBase, handler)
    } else {
      router.use(h.route, handler, h.method)
    }
  }

  h3App.use(config.app.baseURL, router)

  const localCall = createCall(h3App.nodeHandler as any)
  const localFetch = createLocalFetch(localCall, globalThis.fetch)

  const $fetch = createFetch({ fetch: localFetch, Headers, defaults: { baseURL: config.app.baseURL } })
  // @ts-ignore
  globalThis.$fetch = $fetch

  const app: NitroApp = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch
  }

  for (const plugin of plugins) {
    plugin(app)
  }

  return app
}

export const nitroApp: NitroApp = createNitroApp()

export const useNitroApp = () => nitroApp
