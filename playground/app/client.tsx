import { createRoot } from "react-dom/client";

if (import.meta.env.DEV) {
  const RefreshRuntime = await import("react-refresh");
  RefreshRuntime.injectIntoGlobalHook(globalThis as any);
  (globalThis as any).$RefreshReg$ = () => {};
  (globalThis as any).$RefreshSig$ = () => (type: any) => type;
  (globalThis as any).__vite_plugin_react_preamble_installed__ = true;
}

const App = await import("./App.tsx").then((mod) => mod.default);

createRoot(document.querySelector("#app")!).render(<App />);
