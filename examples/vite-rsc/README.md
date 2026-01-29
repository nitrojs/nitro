---
category: vite
icon: i-logos-react
defaultFile: app/root.tsx
---

# Vite RSC

> React Server Components with Vite and Nitro.

This example demonstrates React Server Components (RSC) using Vite's experimental RSC plugin with Nitro. It includes server components, client components, server actions, and streaming SSR.

<!-- automd:dir-tree -->

```
├── app/
│   ├── assets/
│   │   ├── nitro.svg
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── framework/
│   │   ├── entry.browser.tsx
│   │   ├── entry.rsc.tsx
│   │   ├── entry.ssr.tsx
│   │   ├── error-boundary.tsx
│   │   └── request.tsx
│   ├── action.tsx
│   ├── client.tsx
│   ├── index.css
│   └── root.tsx
├── .gitignore
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Overview

1. **SSR Entry** handles incoming requests and renders React components to HTML
2. **Root Component** defines the page structure as a server component
3. **Client Components** use the `"use client"` directive for interactive parts

## 1. SSR Entry

<!-- automd:file src="app/framework/entry.ssr.tsx" code -->

```tsx [entry.ssr.tsx]
import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React from "react";
import type { ReactFormState } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server.edge";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "./entry.rsc";

export default {
  fetch: async (request: Request) => {
    const rscEntryModule = await import.meta.viteRsc.loadModule<typeof import("./entry.rsc")>(
      "rsc",
      "index"
    );
    return rscEntryModule.default(request);
  },
};

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    formState?: ReactFormState;
    nonce?: string;
    debugNoJS?: boolean;
  }
): Promise<{ stream: ReadableStream<Uint8Array>; status?: number }> {
  // Duplicate one RSC stream into two.
  // - one for SSR (ReactClient.createFromReadableStream below)
  // - another for browser hydration payload by injecting <script>...FLIGHT_DATA...</script>.
  const [rscStream1, rscStream2] = rscStream.tee();

  // Deserialize RSC stream back to React VDOM
  let payload: Promise<RscPayload> | undefined;
  function SsrRoot() {
    // Deserialization needs to be kicked off inside ReactDOMServer context
    // for ReactDOMServer preinit/preloading to work
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    return React.use(payload).root;
  }

  // Render HTML (traditional SSR)
  const bootstrapScriptContent = await import.meta.viteRsc.loadBootstrapScriptContent("index");

  let htmlStream: ReadableStream<Uint8Array>;
  let status: number | undefined;

  try {
    htmlStream = await renderToReadableStream(<SsrRoot />, {
      bootstrapScriptContent: options?.debugNoJS ? undefined : bootstrapScriptContent,
      nonce: options?.nonce,
      formState: options?.formState,
    });
  } catch {
    // fallback to render an empty shell and run pure CSR on browser,
    // which can replay server component error and trigger error boundary.
    status = 500;
    htmlStream = await renderToReadableStream(
      <html>
        <body>
          <noscript>Internal Server Error: SSR failed</noscript>
        </body>
      </html>,
      {
        bootstrapScriptContent:
          `self.__NO_HYDRATE=1;` + (options?.debugNoJS ? "" : bootstrapScriptContent),
        nonce: options?.nonce,
      }
    );
  }

  let responseStream: ReadableStream<Uint8Array> = htmlStream;
  if (!options?.debugNoJS) {
    // Initial RSC stream is injected in HTML stream as <script>...FLIGHT_DATA...</script>
    // using utility made by devongovett https://github.com/devongovett/rsc-html-stream
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(rscStream2, {
        nonce: options?.nonce,
      })
    );
  }

  return { stream: responseStream, status };
}
```

<!-- /automd -->

The SSR entry handles the rendering pipeline. It loads the RSC entry module, duplicates the RSC stream (one for SSR, one for hydration), deserializes the stream back to React VDOM, and renders it to HTML. The RSC payload is injected into the HTML for client hydration.

## 2. Root Server Component

<!-- automd:file src="app/root.tsx" code -->

```tsx [root.tsx]
import "./index.css"; // css import is automatically injected in exported server components
import viteLogo from "./assets/vite.svg";
import { getServerCounter, updateServerCounter } from "./action.tsx";
import reactLogo from "./assets/react.svg";
import nitroLogo from "./assets/nitro.svg";
import { ClientCounter } from "./client.tsx";

export function Root(props: { url: URL }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line unicorn/text-encoding-identifier-case */}
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/vite.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Nitro + Vite + RSC</title>
      </head>
      <body>
        <App {...props} />
      </body>
    </html>
  );
}

function App(props: { url: URL }) {
  return (
    <div id="root">
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev/reference/rsc/server-components" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>

        <a href="https://v3.nitro.build" target="_blank">
          <img src={nitroLogo} className="logo" alt="Nitro logo" />
        </a>
      </div>
      <h1>Vite + RSC + Nitro</h1>
      <div className="card">
        <ClientCounter />
      </div>
      <div className="card">
        <form action={updateServerCounter.bind(null, 1)}>
          <button>Server Counter: {getServerCounter()}</button>
        </form>
      </div>
      <div className="card">Request URL: {props.url?.href}</div>
      <ul className="read-the-docs">
        <li>
          Edit <code>src/client.tsx</code> to test client HMR.
        </li>
        <li>
          Edit <code>src/root.tsx</code> to test server HMR.
        </li>
        <li>
          Visit{" "}
          <a href="./_.rsc" target="_blank">
            <code>_.rsc</code>
          </a>{" "}
          to view RSC stream payload.
        </li>
        <li>
          Visit{" "}
          <a href="?__nojs" target="_blank">
            <code>?__nojs</code>
          </a>{" "}
          to test server action without js enabled.
        </li>
      </ul>
    </div>
  );
}
```

<!-- /automd -->

Server components run only on the server. They can import CSS directly, use server-side data, and call server actions. The `ClientCounter` component is imported but runs on the client because it has the `"use client"` directive.

## 3. Client Component

<!-- automd:file src="app/client.tsx" code -->

```tsx [client.tsx]
"use client";

import React from "react";

export function ClientCounter() {
  const [count, setCount] = React.useState(0);

  return <button onClick={() => setCount((count) => count + 1)}>Client Counter: {count}</button>;
}
```

<!-- /automd -->

The `"use client"` directive marks this as a client component. It hydrates on the browser and handles interactive state. Server components can import and render client components, but client components cannot import server components.

## Learn More

- [React Server Components](https://react.dev/reference/rsc/server-components)
