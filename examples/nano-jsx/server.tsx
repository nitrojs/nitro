import { defineHandler } from "nitro";
import { html } from "nitro/h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
