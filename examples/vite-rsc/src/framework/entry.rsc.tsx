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

// The schema of payload which is serialized into RSC stream on rsc environment
// and deserialized on ssr/client environments.
export type RscPayload = {
  // this demo renders/serializes/deserizlies entire root html element
  // but this mechanism can be changed to render/fetch different parts of components
  // based on your own route conventions.
  root: React.ReactNode;
  // server action return value of non-progressive enhancement case
  returnValue?: unknown;
  // server action form state (e.g. useActionState) of progressive enhancement case
  formState?: ReactFormState;
};

// the plugin by default assumes `rsc` entry having default export of request handler.
// however, how server entries are executed can be customized by registering
// own server handler e.g. `@cloudflare/vite-plugin`.
export default async function handler(request: Request): Promise<Response> {
  // handle server function request
  const isAction = request.method === "POST";
  let returnValue: unknown | undefined;
  let formState: ReactFormState | undefined;
  let temporaryReferences: unknown | undefined;
  if (isAction) {
    // x-rsc-action header exists when action is called via `ReactClient.setServerCallback`.
    const actionId = request.headers.get("x-rsc-action");
    if (actionId) {
      const contentType = request.headers.get("content-type");
      const body = contentType?.startsWith("multipart/form-data")
        ? await request.formData()
        : await request.text();
      temporaryReferences = createTemporaryReferenceSet();
      const args = await decodeReply(body, { temporaryReferences });
      const action = await loadServerAction(actionId);
      // eslint-disable-next-line prefer-spread
      returnValue = await action.apply(null, args);
    } else {
      // otherwise server function is called via `<form action={...}>`
      // before hydration (e.g. when javascript is disabled).
      // aka progressive enhancement.
      const formData = await request.formData();
      const decodedAction = await decodeAction(formData);
      const result = await decodedAction();
      formState = await decodeFormState(result, formData);
    }
  }

  // serialization from React VDOM tree to RSC stream.
  // we render RSC stream after handling server function request
  // so that new render reflects updated state from server function call
  // to achieve single round trip to mutate and fetch from server.
  const url = new URL(request.url);
  const rscPayload: RscPayload = {
    root: <Root url={url} />,
    formState,
    returnValue,
  };
  const rscOptions = { temporaryReferences };
  const rscStream = renderToReadableStream<RscPayload>(rscPayload, rscOptions);

  // respond RSC stream without HTML rendering based on framework's convention.
  // here we use request header `content-type`.
  // additionally we allow `?__rsc` and `?__html` to easily view payload directly.
  const isRscRequest =
    (!request.headers.get("accept")?.includes("text/html") &&
      !url.searchParams.has("__html")) ||
    url.searchParams.has("__rsc");

  if (isRscRequest) {
    return new Response(rscStream, {
      headers: {
        "content-type": "text/x-component;charset=utf-8",
        vary: "accept",
      },
    });
  }

  // Delegate to SSR environment for html rendering.
  // The plugin provides `loadModule` helper to allow loading SSR environment entry module
  // in RSC environment. however this can be customized by implementing own runtime communication
  // e.g. `@cloudflare/vite-plugin`'s service binding.
  const ssrEntryModule = await import.meta.viteRsc.loadModule<
    typeof import("./entry.ssr.tsx")
  >("ssr", "index");
  const htmlStream = await ssrEntryModule.renderHTML(rscStream, {
    formState,
    // allow quick simulation of javscript disabled browser
    debugNojs: url.searchParams.has("__nojs"),
  });

  // respond html
  return new Response(htmlStream, {
    headers: {
      "Content-type": "text/html",
      vary: "accept",
    },
  });
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
