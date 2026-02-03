---
category: vite
icon: i-logos-react
---

# Vite RSC

> React Server Components with Vite and Nitro.

<!-- automd:ui-code-tree src="." default="app/root.tsx" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="app/root.tsx" expandAll}

```text [.gitignore]
node_modules
dist
```

```json [package.json]
{
  "name": "@vitejs/plugin-rsc-examples-starter",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19.2.10",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.2",
    "@vitejs/plugin-rsc": "^0.5.17",
    "nitro": "latest",
    "rsc-html-stream": "^0.0.7",
    "vite": "beta"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig",
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "@vitejs/plugin-rsc/types"],
    "jsx": "react-jsx"
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    nitro(),
    rsc({
      serverHandler: false,
      entries: {
        ssr: "./app/framework/entry.ssr.tsx",
        rsc: "./app/framework/entry.rsc.tsx",
      },
    }),
    react(),
  ],

  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: "./app/framework/entry.browser.tsx" },
        },
      },
    },
  },
});
```

```tsx [app/action.tsx]
"use server";

let serverCounter = 0;

export async function getServerCounter() {
  return serverCounter;
}

export async function updateServerCounter(change: number) {
  serverCounter += change;
}
```

```tsx [app/client.tsx]
"use client";

import React from "react";

export function ClientCounter() {
  const [count, setCount] = React.useState(0);

  return <button onClick={() => setCount((count) => count + 1)}>Client Counter: {count}</button>;
}
```

```css [app/index.css]
:root {
  font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 1rem;
}

.read-the-docs {
  color: #888;
  text-align: left;
}
```

```tsx [app/root.tsx]
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

```text [app/assets/nitro.svg]
<!-- nitro logo -->
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#clip0_115_108)">
    <path fill-rule="evenodd" clip-rule="evenodd"
      d="M35.2166 7.02016C28.0478 -1.38317 15.4241 -2.38397 7.02077 4.78481C-1.38256 11.9536 -2.38336 24.5773 4.78542 32.9806C11.9542 41.3839 24.5779 42.3847 32.9812 35.216C41.3846 28.0472 42.3854 15.4235 35.2166 7.02016ZM25.2525 17.5175C26.0233 17.5175 26.5155 18.3527 26.1287 19.0194L26.0175 19.2111L18.4696 31.6294C18.3293 31.8602 18.0788 32.001 17.8088 32.001H17.0883C16.5946 32.001 16.2336 31.5349 16.3573 31.0569L18.4054 23.1384C18.5691 22.5053 18.0912 21.888 17.4373 21.888H14.2914C13.6375 21.888 13.1596 21.2708 13.3232 20.6377L16.4137 8.68289C16.5261 8.28056 16.8904 7.99734 17.3081 8.00208C17.3587 8.00266 17.4046 8.0035 17.4427 8.0047L20.6109 8.00465C21.217 8.00436 21.684 8.53896 21.6023 9.13949L21.5828 9.28246L20.3746 16.349C20.2702 16.9598 20.7406 17.5175 21.3603 17.5175H25.2525Z"
      fill="url(#paint0_diamond_115_108)" />
    <mask id="mask0_115_108" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0"
      width="40" height="41">
      <circle cx="20" cy="20.001" r="20" fill="url(#paint1_diamond_115_108)" />
    </mask>
    <g mask="url(#mask0_115_108)">
      <g filter="url(#filter0_f_115_108)">
        <path
          d="M1.11145 13.4267C0.0703174 16.4179 -0.245523 19.6136 0.189923 22.7507C0.62537 25.8879 1.79965 28.8768 3.61611 31.4713C5.43256 34.0659 7.83925 36.192 10.6381 37.6746C13.4369 39.1572 16.5478 39.9538 19.7147 39.999C22.8816 40.0442 26.0139 39.3366 28.8539 37.9345C31.6939 36.5324 34.1602 34.4758 36.05 31.9341C37.9397 29.3924 39.1988 26.4383 39.7236 23.3148C40.2483 20.1914 40.0238 16.9879 39.0684 13.9682L33.2532 15.808C33.9172 17.9068 34.0732 20.1333 33.7085 22.3042C33.3438 24.4751 32.4687 26.5283 31.1552 28.2949C29.8418 30.0615 28.1276 31.4908 26.1537 32.4653C24.1799 33.4399 22.0028 33.9316 19.8017 33.9002C17.6006 33.8688 15.4384 33.3151 13.4932 32.2847C11.5479 31.2543 9.87518 29.7766 8.61269 27.9733C7.35019 26.1699 6.53403 24.0926 6.23138 21.9122C5.92873 19.7317 6.14825 17.5106 6.87187 15.4316L1.11145 13.4267Z"
          fill="white" />
      </g>
    </g>
  </g>
  <defs>
    <filter id="filter0_f_115_108" x="-10" y="3.42667" width="60" height="46.5744"
      filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
      <feGaussianBlur stdDeviation="5" result="effect1_foregroundBlur_115_108" />
    </filter>
    <radialGradient id="paint0_diamond_115_108" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(4.00069 20.0004) scale(39.0007 397.71)">
      <stop stop-color="#31B2F3" />
      <stop offset="0.473958" stop-color="#F27CEC" />
      <stop offset="1" stop-color="#FD6641" />
    </radialGradient>
    <radialGradient id="paint1_diamond_115_108" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(4 20.0011) scale(39 397.703)">
      <stop stop-color="#F27CEC" />
      <stop offset="0.484375" stop-color="#31B2F3" />
      <stop offset="1" stop-color="#7D7573" />
    </radialGradient>
    <clipPath id="clip0_115_108">
      <rect width="146" height="40.001" fill="white" />
    </clipPath>
  </defs>
</svg>
```

```text [app/assets/react.svg]
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>
```

```text [app/assets/vite.svg]
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>
```

```tsx [app/framework/entry.browser.tsx]
import {
  createFromReadableStream,
  createFromFetch,
  setServerCallback,
  createTemporaryReferenceSet,
  encodeReply,
} from "@vitejs/plugin-rsc/browser";
import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
import { GlobalErrorBoundary } from "./error-boundary";
import type { RscPayload } from "./entry.rsc";
import { createRscRenderRequest } from "./request";

async function main() {
  // Stash `setPayload` function to trigger re-rendering
  // from outside of `BrowserRoot` component (e.g. server function call, navigation, hmr)
  let setPayload: (v: RscPayload) => void;

  // Deserialize RSC stream back to React VDOM for CSR
  const initialPayload = await createFromReadableStream<RscPayload>(
    // Initial RSC stream is injected in SSR stream as <script>...FLIGHT_DATA...</script>
    rscStream
  );

  // Browser root component to (re-)render RSC payload as state
  function BrowserRoot() {
    const [payload, setPayload_] = React.useState(initialPayload);

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v));
    }, [setPayload_]);

    // Re-fetch/render on client side navigation
    React.useEffect(() => {
      return listenNavigation(() => fetchRscPayload());
    }, []);

    return payload.root;
  }

  // Re-fetch RSC and trigger re-rendering
  async function fetchRscPayload() {
    const renderRequest = createRscRenderRequest(globalThis.location.href);
    const payload = await createFromFetch<RscPayload>(fetch(renderRequest));
    setPayload(payload);
  }

  // Register a handler which will be internally called by React
  // on server function request after hydration.
  setServerCallback(async (id, args) => {
    const temporaryReferences = createTemporaryReferenceSet();
    const renderRequest = createRscRenderRequest(globalThis.location.href, {
      id,
      body: await encodeReply(args, { temporaryReferences }),
    });
    const payload = await createFromFetch<RscPayload>(fetch(renderRequest), {
      temporaryReferences,
    });
    setPayload(payload);
    const { ok, data } = payload.returnValue!;
    if (!ok) throw data;
    return data;
  });

  // Hydration
  const browserRoot = (
    <React.StrictMode>
      <GlobalErrorBoundary>
        <BrowserRoot />
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
  if ("__NO_HYDRATE" in globalThis) {
    createRoot(document).render(browserRoot);
  } else {
    hydrateRoot(document, browserRoot, {
      formState: initialPayload.formState,
    });
  }

  // Implement server HMR by triggering re-fetch/render of RSC upon server code change
  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", () => {
      fetchRscPayload();
    });
  }
}

// A little helper to setup events interception for client side navigation
function listenNavigation(onNavigation: () => void) {
  globalThis.addEventListener("popstate", onNavigation);

  const oldPushState = globalThis.history.pushState;
  globalThis.history.pushState = function (...args) {
    const res = oldPushState.apply(this, args);
    onNavigation();
    return res;
  };

  const oldReplaceState = globalThis.history.replaceState;
  globalThis.history.replaceState = function (...args) {
    const res = oldReplaceState.apply(this, args);
    onNavigation();
    return res;
  };

  function onClick(e: MouseEvent) {
    const link = (e.target as Element).closest("a");
    if (
      link &&
      link instanceof HTMLAnchorElement &&
      link.href &&
      (!link.target || link.target === "_self") &&
      link.origin === location.origin &&
      !link.hasAttribute("download") &&
      e.button === 0 && // left clicks only
      !e.metaKey && // open in new tab (mac)
      !e.ctrlKey && // open in new tab (windows)
      !e.altKey && // download
      !e.shiftKey &&
      !e.defaultPrevented
    ) {
      e.preventDefault();
      history.pushState(null, "", link.href);
    }
  }
  document.addEventListener("click", onClick);

  return () => {
    document.removeEventListener("click", onClick);
    globalThis.removeEventListener("popstate", onNavigation);
    globalThis.history.pushState = oldPushState;
    globalThis.history.replaceState = oldReplaceState;
  };
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main();
```

```tsx [app/framework/entry.rsc.tsx]
import {
  renderToReadableStream,
  createTemporaryReferenceSet,
  decodeReply,
  loadServerAction,
  decodeAction,
  decodeFormState,
} from "@vitejs/plugin-rsc/rsc";
import type { ReactFormState } from "react-dom/client";
import { Root } from "../root.tsx";
import { parseRenderRequest } from "./request.tsx";

// The schema of payload which is serialized into RSC stream on rsc environment
// and deserialized on ssr/client environments.
export type RscPayload = {
  // this demo renders/serializes/deserializes entire root html element
  // but this mechanism can be changed to render/fetch different parts of components
  // based on your own route conventions.
  root: React.ReactNode;

  // Server action return value of non-progressive enhancement case
  returnValue?: { ok: boolean; data: unknown };

  // Server action form state (e.g. useActionState) of progressive enhancement case
  formState?: ReactFormState;
};

// The plugin by default assumes `rsc` entry having default export of request handler.
// however, how server entries are executed can be customized by registering own server handler.
export default async function handler(request: Request): Promise<Response> {
  // Differentiate RSC, SSR, action, etc.
  const renderRequest = parseRenderRequest(request);
  request = renderRequest.request;

  // Handle server function request
  let returnValue: RscPayload["returnValue"] | undefined;
  let formState: ReactFormState | undefined;
  let temporaryReferences: unknown | undefined;
  let actionStatus: number | undefined;

  if (renderRequest.isAction === true) {
    if (renderRequest.actionId) {
      // Action is called via `ReactClient.setServerCallback`.
      const contentType = request.headers.get("content-type");
      const body = contentType?.startsWith("multipart/form-data")
        ? await request.formData()
        : await request.text();
      temporaryReferences = createTemporaryReferenceSet();
      const args = await decodeReply(body, { temporaryReferences });
      const action = await loadServerAction(renderRequest.actionId);
      try {
        // eslint-disable-next-line prefer-spread
        const data = await action.apply(null, args);
        returnValue = { ok: true, data };
      } catch (error_) {
        returnValue = { ok: false, data: error_ };
        actionStatus = 500;
      }
    } else {
      // Otherwise server function is called via `<form action={...}>`
      // before hydration (e.g. when JavaScript is disabled).
      // aka progressive enhancement.
      const formData = await request.formData();
      const decodedAction = await decodeAction(formData);
      try {
        const result = await decodedAction();
        formState = await decodeFormState(result, formData);
      } catch {
        // there's no single general obvious way to surface this error,
        // so explicitly return classic 500 response.
        return new Response("Internal Server Error: server action failed", {
          status: 500,
        });
      }
    }
  }

  // Serialization from React VDOM tree to RSC stream.
  // We render RSC stream after handling server function request
  // so that new render reflects updated state from server function call
  // to achieve single round trip to mutate and fetch from server.
  const rscPayload: RscPayload = {
    root: <Root url={renderRequest.url} />,
    formState,
    returnValue,
  };

  const rscOptions = { temporaryReferences };
  const rscStream = renderToReadableStream<RscPayload>(rscPayload, rscOptions);

  // Respond RSC stream without HTML rendering as decided by `RenderRequest`
  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      status: actionStatus,
      headers: {
        "content-type": "text/x-component;charset=utf-8",
      },
    });
  }

  // Delegate to SSR environment for HTML rendering.
  // The plugin provides `loadModule` helper to allow loading SSR environment entry module
  // in RSC environment. however this can be customized by implementing own runtime communication
  // e.g. `@cloudflare/vite-plugin`'s service binding.
  const ssrEntryModule = await import.meta.viteRsc.loadModule<typeof import("./entry.ssr.tsx")>(
    "ssr",
    "index"
  );

  const ssrResult = await ssrEntryModule.renderHTML(rscStream, {
    formState,
    // Allow quick simulation of JavaScript disabled browser
    debugNoJS: renderRequest.url.searchParams.has("__nojs"),
  });

  // Respond HTML
  return new Response(ssrResult.stream, {
    status: ssrResult.status,
    headers: {
      "Content-Type": "text/html",
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
```

```tsx [app/framework/entry.ssr.tsx]
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

```tsx [app/framework/error-boundary.tsx]
"use client";

import React from "react";

// Minimal ErrorBoundary example to handle errors globally on browser
export function GlobalErrorBoundary(props: { children?: React.ReactNode }) {
  return <ErrorBoundary errorComponent={DefaultGlobalErrorPage}>{props.children}</ErrorBoundary>;
}

// https://github.com/vercel/next.js/blob/33f8428f7066bf8b2ec61f025427ceb2a54c4bdf/packages/next/src/client/components/error-boundary.tsx
// https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
class ErrorBoundary extends React.Component<{
  children?: React.ReactNode;
  errorComponent: React.FC<{
    error: Error;
    reset: () => void;
  }>;
}> {
  override state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const error = this.state.error;
    if (error) {
      return <this.props.errorComponent error={error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

// https://github.com/vercel/next.js/blob/677c9b372faef680d17e9ba224743f44e1107661/packages/next/src/build/webpack/loaders/next-app-loader.ts#L73
// https://github.com/vercel/next.js/blob/677c9b372faef680d17e9ba224743f44e1107661/packages/next/src/client/components/error-boundary.tsx#L145
function DefaultGlobalErrorPage(props: { error: Error; reset: () => void }) {
  return (
    <html>
      <head>
        <title>Unexpected Error</title>
      </head>
      <body
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          placeContent: "center",
          placeItems: "center",
          fontSize: "16px",
          fontWeight: 400,
          lineHeight: "24px",
        }}
      >
        <p>Caught an unexpected error</p>
        <pre>
          Error:{" "}
          {import.meta.env.DEV && "message" in props.error ? props.error.message : "(Unknown)"}
        </pre>
        <button
          onClick={() => {
            React.startTransition(() => {
              props.reset();
            });
          }}
        >
          Reset
        </button>
      </body>
    </html>
  );
}
```

```tsx [app/framework/request.tsx]
// Framework conventions (arbitrary choices for this demo):
// - Use `_.rsc` URL suffix to differentiate RSC requests from SSR requests
// - Use `x-rsc-action` header to pass server action ID
const URL_POSTFIX = "_.rsc";
const HEADER_ACTION_ID = "x-rsc-action";

// Parsed request information used to route between RSC/SSR rendering and action handling.
// Created by parseRenderRequest() from incoming HTTP requests.
type RenderRequest = {
  isRsc: boolean; // true if request should return RSC payload (via _.rsc suffix)
  isAction: boolean; // true if this is a server action call (POST request)
  actionId?: string; // server action ID from x-rsc-action header
  request: Request; // normalized Request with _.rsc suffix removed from URL
  url: URL; // normalized URL with _.rsc suffix removed
};

export function createRscRenderRequest(
  urlString: string,
  action?: { id: string; body: BodyInit }
): Request {
  const url = new URL(urlString);
  url.pathname += URL_POSTFIX;
  const headers = new Headers();
  if (action) {
    headers.set(HEADER_ACTION_ID, action.id);
  }
  return new Request(url.toString(), {
    method: action ? "POST" : "GET",
    headers,
    body: action?.body,
  });
}

export function parseRenderRequest(request: Request): RenderRequest {
  const url = new URL(request.url);
  const isAction = request.method === "POST";
  if (url.pathname.endsWith(URL_POSTFIX)) {
    url.pathname = url.pathname.slice(0, -URL_POSTFIX.length);
    const actionId = request.headers.get(HEADER_ACTION_ID) || undefined;
    if (request.method === "POST" && !actionId) {
      throw new Error("Missing action id header for RSC action request");
    }
    return {
      isRsc: true,
      isAction,
      actionId,
      request: new Request(url, request),
      url,
    };
  } else {
    return {
      isRsc: false,
      isAction,
      request,
      url,
    };
  }
}
```

::

<!-- /automd -->

<!-- automd:file src="GUIDE.md" -->

<!-- /automd -->

## Learn More

- [React Server Components](https://react.dev/reference/rsc/server-components)
