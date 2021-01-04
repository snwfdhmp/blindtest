import { server } from "../services/server.js";
import { config, loadConfig } from "../core/config.js";

import { EventEmitter } from "events";

EventEmitter.defaultMaxListeners = 20;

async function main() {
  console.time("server.start");
  await loadConfig();

  await server.init({ ...config });
}

main();
