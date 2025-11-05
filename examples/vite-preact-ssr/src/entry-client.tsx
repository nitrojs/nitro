import { hydrate } from "preact";
import { Counter } from "./counter";

function main() {
  hydrate(<Counter />, document.querySelector("#counter")!);
}

main();
