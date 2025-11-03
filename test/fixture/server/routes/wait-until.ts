const timeTakingOperation = async () => {
  // console.log("wait-until.ts: timeTakingOperation() start");
  await new Promise((resolve) => setTimeout(resolve, 100));
  // console.log("wait-until.ts: timeTakingOperation() done");
};

export default defineHandler((event) => {
  event.waitUntil(timeTakingOperation());

  return "done";
});
