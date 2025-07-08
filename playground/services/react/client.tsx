/// <reference types="vite/client" />
import { createRoot } from "react-dom/client";
import RefreshRuntime from "react-refresh";

if (import.meta.env.DEV) {
  RefreshRuntime.injectIntoGlobalHook(globalThis);
  globalThis.$RefreshReg$ = () => {};
  globalThis.$RefreshSig$ = () => (type) => type;
  globalThis.__vite_plugin_react_preamble_installed__ = true;
}

const App = await import("./App.jsx").then((mod) => mod.default);

createRoot(document.querySelector("#app")!).render(<App />);
