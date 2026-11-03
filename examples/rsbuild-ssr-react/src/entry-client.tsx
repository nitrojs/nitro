import "./styles.css";
import { hydrateRoot } from "react-dom/client";
import { App } from "./app.tsx";

hydrateRoot(document.querySelector("#app")!, <App />);
