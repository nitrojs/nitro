import { hydrate } from "preact";
import { App } from "./app.tsx";

function main() {
  hydrate(<App />, document.querySelector("#app")!);
}

main();
