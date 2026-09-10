import { state } from "./lazy-state.ts";

state.dependency++;

export function query() {
  state.handler++;
  return { ...state };
}
