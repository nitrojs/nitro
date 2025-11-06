import { defineHandler, html } from "h3";
import { h, renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1 className="test">Hello JSX!</h1>));
});
