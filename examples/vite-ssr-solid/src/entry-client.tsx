import { hydrate } from "solid-js/web";
import "./styles.css";
import { App } from "./app.jsx";

hydrate(() => <App />, document.querySelector("#app")!);
