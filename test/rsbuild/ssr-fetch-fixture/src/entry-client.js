import "./style.css";

document.querySelector("#app").dataset.hydrated = "true";
document.addEventListener("click", () => import("./lazy.js"));
