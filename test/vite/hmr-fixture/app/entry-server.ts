import { html } from "nitro/h3";
import { serverFetch } from "nitro";
import { state } from "../shared.ts";

export default {
  fetch: async () => {
    const apiData = (await serverFetch("/api/state").then((res) => res.json())) as {
      state: number;
    };
    const viteClientScript = "<script type='module' src='/@vite/client'></script>";
    const clientScript = "<script type='module' src='/app/entry-client.ts'></script>";
    return html`
    <!doctype html>
    <html lang="en">
      <head>${viteClientScript}</head>
      <body>
        <h1>SSR Page</h1>
        <p>[SSR] state: ${state}</p>
        <p>[API] state: ${apiData.state}</p>
        <p id="client-state">[Client] state: <span id="client-state-value">?</span></p>
        ${clientScript}
      </body>
    </html>
  `;
  },
};
