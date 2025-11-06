import { defineHandler } from "nitro/h3";

export default defineHandler(() => `<h1>${makeGreeting("Nitro")}</h1>`);
