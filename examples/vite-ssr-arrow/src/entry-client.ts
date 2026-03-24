import { App } from "./app.ts";

const root = document.getElementById("app")!;
root.textContent = "";
App()(root);
