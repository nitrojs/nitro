import { WorkerEntrypoint } from "cloudflare:workers";
import { shared } from "./shared.ts";

export class Greeter extends WorkerEntrypoint {
  greet(name: string) {
    return { greeting: `hello ${name}`, hits: shared.hits };
  }
}
