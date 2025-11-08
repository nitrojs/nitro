import { html } from "nitro/h3";
import { h, renderSSR } from "nano-jsx";

export default () => {
  return html(renderSSR(() => <h1 className="test">Hello JSX!</h1>));
};
