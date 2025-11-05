import { createFromReadableStream } from "@vitejs/plugin-rsc/ssr";
import React from "react";
import type { ReactFormState } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server.edge";
import { injectRSCPayload } from "rsc-html-stream/server";
import type { RscPayload } from "./entry.rsc";

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    formState?: ReactFormState;
    nonce?: string;
    debugNojs?: boolean;
  }
) {
  // duplicate one RSC stream into two.
  // - one for SSR (ReactClient.createFromReadableStream below)
  // - another for browser hydration payload by injecting <script>...FLIGHT_DATA...</script>.
  const [rscStream1, rscStream2] = rscStream.tee();

  // deserialize RSC stream back to React VDOM
  let payload: Promise<RscPayload> | undefined;
  function SsrRoot() {
    // deserialization needs to be kicked off inside ReactDOMServer context
    // for ReactDomServer preinit/preloading to work
    payload ??= createFromReadableStream<RscPayload>(rscStream1);
    return <FixSsrThenable>{React.use(payload).root}</FixSsrThenable>;
  }

  // Add an empty component in between `SsrRoot` and user `root` to avoid React SSR bugs.
  //   SsrRoot (use)
  //     => FixSsrThenable
  //       => root (which potentially has `lazy` + `use`)
  // https://github.com/facebook/react/issues/33937#issuecomment-3091349011
  function FixSsrThenable(props: React.PropsWithChildren) {
    return props.children;
  }

  // render html (traditional SSR)
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent("index");
  const htmlStream = await renderToReadableStream(<SsrRoot />, {
    bootstrapScriptContent: options?.debugNojs
      ? undefined
      : bootstrapScriptContent,
    nonce: options?.nonce,
    formState: options?.formState,
  });

  let responseStream: ReadableStream<Uint8Array> = htmlStream;
  if (!options?.debugNojs) {
    // initial RSC stream is injected in HTML stream as <script>...FLIGHT_DATA...</script>
    // using utility made by devongovett https://github.com/devongovett/rsc-html-stream
    responseStream = responseStream.pipeThrough(
      injectRSCPayload(rscStream2, {
        nonce: options?.nonce,
      })
    );
  }

  return responseStream;
}

declare let __nitro_vite_envs__: any;

async function ssrHandler(request: Request) {
  const rscEntryModule = await __nitro_vite_envs__.rsc.runner.import(
    "/src/framework/entry.rsc.tsx"
  );
  return rscEntryModule.default(request);
}

export default {
  fetch: ssrHandler,
};
