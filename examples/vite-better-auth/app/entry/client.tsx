import "@vitejs/plugin-react/preamble";
import { hydrateRoot } from "react-dom/client";

import { App } from "@/app/app.tsx";

hydrateRoot(document.querySelector("#app")!, <App />);
