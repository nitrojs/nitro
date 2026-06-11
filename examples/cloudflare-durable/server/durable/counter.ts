import { DurableObject } from "cloudflare:workers";

export class CounterDO extends DurableObject {
  async increment(amount: number = 1): Promise<number> {
    const count = ((await this.ctx.storage.get<number>("count")) ?? 0) + amount;
    await this.ctx.storage.put("count", count);
    return count;
  }
}
