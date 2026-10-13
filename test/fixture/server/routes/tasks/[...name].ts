import { defineHandler, getQuery } from "nitro/h3";
import { runTask } from "nitro/task";

export default defineHandler(async (event) => {
  const name = event.context.params!.name;
  const payload = { ...getQuery(event) };
  const { result } = await runTask(name, { payload });
  return {
    name,
    payload,
    result,
  };
});
