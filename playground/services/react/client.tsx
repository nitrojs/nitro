/// <reference types="vite/client" />
import { createRoot } from "react-dom/client";

if (import.meta.env.DEV) {
  const RefreshRuntime = await import("react-refresh");
  RefreshRuntime.injectIntoGlobalHook(globalThis);
  globalThis.$RefreshReg$ = () => {};
  globalThis.$RefreshSig$ = () => (type) => type;
  globalThis.__vite_plugin_react_preamble_installed__ = true;
}

const App = await import("./App.jsx").then((mod) => mod.default);

createRoot(document.querySelector("#app")!).render(<App />);
