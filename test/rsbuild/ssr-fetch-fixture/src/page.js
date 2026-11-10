// Emits a CSS asset in the output of the server environment
import styleURL from "./style.css?url";

export function renderPage(pathname) {
  return `<p id="ssr" data-style="${styleURL}">${pathname}</p>`;
}
