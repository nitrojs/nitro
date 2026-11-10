import { fetch } from "nitro";

export default {
  async fetch(req: Request) {
    const { message } = (await fetch("/api/hello").then((res) => res.json())) as {
      message: string;
    };
    return /* html */ `
      <h1>${message}</h1>
      <p>Rendered on the server for <code>${new URL(req.url).pathname}</code>.</p>
      <button id="counter" disabled>Count: 0</button>
    `;
  },
};
