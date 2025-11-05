import {
  createFromReadableStream,
  createFromFetch,
  setServerCallback,
  createTemporaryReferenceSet,
  encodeReply,
} from "@vitejs/plugin-rsc/browser";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
import type { RscPayload } from "./entry.rsc";

async function main() {
  // stash `setPayload` function to trigger re-rendering
  // from outside of `BrowserRoot` component (e.g. server function call, navigation, hmr)
  let setPayload: (v: RscPayload) => void;

  // deserialize RSC stream back to React VDOM for CSR
  const initialPayload = await createFromReadableStream<RscPayload>(
    // initial RSC stream is injected in SSR stream as <script>...FLIGHT_DATA...</script>
    rscStream
  );

  // browser root component to (re-)render RSC payload as state
  function BrowserRoot() {
    const [payload, setPayload_] = React.useState(initialPayload);

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v));
    }, [setPayload_]);

    // re-fetch/render on client side navigation
    React.useEffect(() => {
      return listenNavigation(() => fetchRscPayload());
    }, []);

    return payload.root;
  }

  // re-fetch RSC and trigger re-rendering
  async function fetchRscPayload() {
    const payload = await createFromFetch<RscPayload>(
      fetch(globalThis.location.href)
    );
    setPayload(payload);
  }

  // register a handler which will be internally called by React
  // on server function request after hydration.
  setServerCallback(async (id, args) => {
    const url = new URL(globalThis.location.href);
    const temporaryReferences = createTemporaryReferenceSet();
    const payload = await createFromFetch<RscPayload>(
      fetch(url, {
        method: "POST",
        body: await encodeReply(args, { temporaryReferences }),
        headers: {
          "x-rsc-action": id,
        },
      }),
      { temporaryReferences }
    );
    setPayload(payload);
    return payload.returnValue;
  });

  // hydration
  const browserRoot = (
    <React.StrictMode>
      <BrowserRoot />
    </React.StrictMode>
  );
  hydrateRoot(document, browserRoot, {
    formState: initialPayload.formState,
  });

  // implement server HMR by trigering re-fetch/render of RSC upon server code change
  if (import.meta.hot) {
    import.meta.hot.on("rsc:update", () => {
      fetchRscPayload();
    });
  }
}

// a little helper to setup events interception for client side navigation
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
