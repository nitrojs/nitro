Nitro supports file-based routing in the `api/` or `routes/` directory. Each file becomes an API endpoint based on its path.

## Basic Route

Create a file in the `api/` directory to define a route. The file path becomes the URL path:

<!-- automd:file src="api/hello.ts" code -->

<!-- /automd -->

This creates a `GET /api/hello` endpoint.

## Dynamic Routes

Use square brackets `[param]` for dynamic URL segments. Access params via `event.context.params`:

<!-- automd:file src="api/hello/[name].ts" code -->

<!-- /automd -->

This creates a `GET /api/hello/:name` endpoint (e.g., `/api/hello/world`).

## HTTP Methods

Suffix your file with the HTTP method (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`, etc.):

### GET Handler

<!-- automd:file src="api/test.get.ts" code -->

<!-- /automd -->

### POST Handler

<!-- automd:file src="api/test.post.ts" code -->

<!-- /automd -->
