import { defineHandler } from "h3";

export default defineHandler((event) => {
  return Date.now();
});
