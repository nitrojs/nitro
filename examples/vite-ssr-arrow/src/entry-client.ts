import { render } from "@arrow-js/framework";
import { App } from "./app.ts";

// TODO: hydrate() adopts DOM nodes but loses reactivity due to
// JSDOM vs browser whitespace serialization differences causing
// text node misalignment in the adoption map.
// import { hydrate, readPayload } from "@arrow-js/hydrate";
// const payload = readPayload();
// await hydrate(root, App(), payload);

const root = document.getElementById("app")!;

await render(root, App());
