// Framework conventions (arbitrary choices for this demo):
// - Use `_.rsc` URL suffix to differentiate RSC requests from SSR requests
// - Use `x-rsc-action` header to pass server action ID
const URL_POSTFIX = '_.rsc'
const HEADER_ACTION_ID = 'x-rsc-action'

// Parsed request information used to route between RSC/SSR rendering and action handling.
// Created by parseRenderRequest() from incoming HTTP requests.
type RenderRequest = {
  isRsc: boolean // true if request should return RSC payload (via _.rsc suffix)
  isAction: boolean // true if this is a server action call (POST request)
  actionId?: string // server action ID from x-rsc-action header
  request: Request // normalized Request with _.rsc suffix removed from URL
  url: URL // normalized URL with _.rsc suffix removed
}

export function createRscRenderRequest(
  urlString: string,
  action?: { id: string; body: BodyInit },
): Request {
  const url = new URL(urlString)
  url.pathname += URL_POSTFIX
  const headers = new Headers()
  if (action) {
    headers.set(HEADER_ACTION_ID, action.id)
  }
  return new Request(url.toString(), {
    method: action ? 'POST' : 'GET',
    headers,
    body: action?.body,
  })
}

export function parseRenderRequest(request: Request): RenderRequest {
  const url = new URL(request.url)
  const isAction = request.method === 'POST'
  if (url.pathname.endsWith(URL_POSTFIX)) {
    url.pathname = url.pathname.slice(0, -URL_POSTFIX.length)
    const actionId = request.headers.get(HEADER_ACTION_ID) || undefined
    if (request.method === 'POST' && !actionId) {
      throw new Error('Missing action id header for RSC action request')
    }
    return {
      isRsc: true,
      isAction,
      actionId,
      request: new Request(url, request),
      url,
    }
  } else {
    return {
      isRsc: false,
      isAction,
      request,
      url,
    }
  }
}
