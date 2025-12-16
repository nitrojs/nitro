import { defineHandler, html } from "h3";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Nitro + nano-jsx works!</h1>));
});
