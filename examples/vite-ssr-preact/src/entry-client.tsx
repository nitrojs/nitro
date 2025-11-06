import { hydrate } from "preact";
import { App } from "./app";

function main() {
  hydrate(<App />, document.querySelector("#app")!);
}

main();
