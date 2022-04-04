import { Worker } from 'worker_threads'
import { existsSync, promises as fsp } from 'fs'
import { debounce } from 'perfect-debounce'
import { CompatibilityEvent, createApp, eventHandler } from 'h3'
import httpProxy from 'http-proxy'
import { listen, Listener, ListenOptions } from 'listhen'
import { servePlaceholder } from 'serve-placeholder'
import serveStatic from 'serve-static'
import { resolve } from 'pathe'
import { joinURL } from 'ufo'
import type { Nitro } from '../types'
import { createVFSHandler } from './vfs'

export interface NitroWorker {
  worker: Worker,
  address: { host: string, port: number, socketPath?: string }
}

function initWorker (filename: string): Promise<NitroWorker> | null {
  if (!existsSync(filename)) {
    return null
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(filename)
    worker.once('exit', (code) => {
      reject(new Error(code ? '[worker] exited with code: ' + code : '[worker] exited'))
    })
    worker.once('error', (err) => {
      err.message = '[worker init]' + err.message
      reject(err)
    })
    const addressListener = (event) => {
      if (!event || !event.address) {
        return
      }
      worker.off('message', addressListener)
      resolve({
        worker,
        address: event.address
      } as NitroWorker)
    }
    worker.on('message', addressListener)
  })
}

async function killWorker (worker?: NitroWorker) {
  if (!worker) {
    return
  }
  if (worker.worker) {
    worker.worker.removeAllListeners()
    await worker.worker.terminate()
    worker.worker = null
  }
  if (worker.address.socketPath && existsSync(worker.address.socketPath)) {
    await fsp.rm(worker.address.socketPath)
  }
}

export function createDevServer (nitro: Nitro) {
  // Worker
  const workerEntry = resolve(nitro.options.output.dir, nitro.options.output.serverDir, 'index.mjs')

  let lastError: Error = null
  let reloadPromise: Promise<void> = null

  let currentWorker: NitroWorker = null
  async function _reload () {
    // Kill old worker
    const oldWorker = currentWorker
    currentWorker = null
    await killWorker(oldWorker)
    // Create a new worker
    currentWorker = await initWorker(workerEntry)
  }
  const reload = debounce(() => {
    reloadPromise = _reload().then(() => {
      lastError = null
    }).catch((error) => {
      console.error('[worker reload]', error)
      lastError = error
    }).finally(() => {
      reloadPromise = null
    })
    return reloadPromise
  })
  nitro.hooks.hook('nitro:dev:reload', reload)

  // App
  const app = createApp()

  // Dev-only handlers
  for (const handler of nitro.options.devHandlers) {
    app.use(handler.route || '/', handler.handler)
  }
  // Debugging endpoint to view vfs
  app.use('/_vfs', createVFSHandler(nitro))

  // Serve asset dirs
  for (const asset of nitro.options.publicAssets) {
    const url = joinURL(nitro.options.app.baseURL, asset.baseURL)
    app.use(url, serveStatic(asset.dir))
    if (!asset.fallthrough) {
      app.use(url, servePlaceholder())
    }
  }

  // Serve placeholder 404 assets instead of hitting SSR
  // TODO: Option to opt-out
  app.use(nitro.options.app.baseURL, servePlaceholder({ skipUnknown: true }))

  // Worker proxy
  const proxy = httpProxy.createProxy()
  app.use(eventHandler(async (event) => {
    await reloadPromise
    const address = currentWorker?.address
    if (!address || (address.socketPath && !existsSync(address.socketPath))) {
      return sendUnavailable(event, lastError)
    }
    return new Promise((resolve, reject) => {
      proxy.web(event.req, event.res, { target: address }, (error: any) => {
        lastError = error
        if (error.code !== 'ECONNRESET') {
          reject(error)
        }
        resolve()
      })
    })
  }))

  // Listen
  let listeners: Listener[] = []
  const _listen = async (port: ListenOptions['port'], opts?: Partial<ListenOptions>) => {
    const listener = await listen(app, { port, ...opts })
    listeners.push(listener)
    return listener
  }

  // Close handler
  async function close () {
    await killWorker(currentWorker)
    await Promise.all(listeners.map(l => l.close()))
    listeners = []
  }
  nitro.hooks.hook('close', close)

  return {
    reload,
    listen: _listen,
    app,
    close
  }
}

function sendUnavailable (event: CompatibilityEvent, error?: Error) {
  event.res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  event.res.statusCode = 503
  event.res.statusMessage = 'Service Unavailable'
  event.res.end(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <title>Nitro dev server</title>
    <style> body { margin: 2em; } </style>
  </head>
  </head>
  <body>
    <h1>Nitro worker is unavailable.</h1>
    ${error ? `<pre>${error.stack}</pre>` : 'Please try again in a few seconds...'}
  </body>
</html>
`)
}
