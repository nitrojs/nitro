import { hydrate } from "preact";
import { App } from "./app.ts";

function main() {
  hydrate(<App />, document.querySelector("#app")!);
}

main();
