import { buildSeenByConsumer } from "@fixture/consumer";
import { build } from "@fixture/dual";

export default {
  fetch: () => Response.json({ app: build, consumer: buildSeenByConsumer }),
};
