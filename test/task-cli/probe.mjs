import { appendFileSync } from "node:fs";
import net from "node:net";
import cluster from "node:cluster";
import { syncBuiltinESMExports } from "node:module";

function mark(stage) {
  if (process.env.TASK_CLI_EVENTS) {
    appendFileSync(process.env.TASK_CLI_EVENTS, JSON.stringify({ stage, pid: process.pid }) + "\n");
  }
}

globalThis.__taskCLIProbe = (kind) => mark(`framework:${kind}`);
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  mark("framework:listen");
  return Reflect.apply(listen, this, args);
};
const fork = cluster.fork;
if (typeof fork === "function") {
  cluster.fork = function (...args) {
    mark("framework:fork");
    return Reflect.apply(fork, this, args);
  };
}
syncBuiltinESMExports();
mark("probe:installed");
