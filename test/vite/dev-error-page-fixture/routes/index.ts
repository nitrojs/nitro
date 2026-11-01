import { broken } from "../state.ts";

export default () => {
  if (broken) {
    throw new Error("broken page");
  }
  return new Response("<h1>fixed</h1>", { headers: { "content-type": "text/html" } });
};
