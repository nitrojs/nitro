import path from "node:path";
import fs from "node:fs";
import { lemon } from "../utils/lemon";

const peach = {
  color: color(),
};

defineRouteMeta({
  test: path.join("test1", "test2"),
  apple: apple(),
  lemon,
  ...peach,
});

export default eventHandler(async (event) => {
  fs.readFileSync("test.txt", "utf8");

  sideEffect();

  return {};
});

function apple() {
  return 45;
}

function orange() {
  return 6;
}

function sideEffect() {
  console.log("sideEffect");
}

function color() {
  return orange();
}
