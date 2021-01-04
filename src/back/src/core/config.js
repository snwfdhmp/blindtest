import dotenv from "dotenv";
import { log } from "./log.js";
dotenv.config();
export let config = null;

export async function loadConfig() {
  config = {};
  config.version = process.env.VERSION || "development";
  config.serverPort = process.env.PORT || "4000";
  config.jwtSecret = process.env.NODE_JWT_SECRET || "somesecret-0136@296./.&";
  config.environment = process.env.NODE_ENV || "production";
  config.dsn = process.env.DATABASE_URL;
  config.spotifyClientId =
    process.env.NODE_BLINDTEST_SPOTIFY_CLIENT_ID ||
    "5f1b134b26494209a4a0e02f4d7d868a";
  config.spotifyClientSecret =
    process.env.NODE_BLINDTEST_SPOTIFY_CLIENT_SECRET ||
    "47a60f1f7edc425cb22acaa54a98bdaf";
  config.spotifyClientAuthorizationHeader = `Basic ${Buffer.from(
    `${config.spotifyClientId}:${config.spotifyClientSecret}`
  ).toString("base64")}`;
  config.dbForceSync = process.env.NODE_DB_FORCE_SYNC || false;
  config.disableSeeding = process.env.NODE_DISABLE_SEEDING || false;
  if (!config.dbForceSync) {
    log.warn({
      step: "loadConfig",
      msg: "setting disableSeeding=true because dbForceSync=false",
    });
    config.disableSeeding = true;
  }
  if (config.dsn == "") {
    log.error({ error: "missing env DATABASE_URL" });
    process.exit(1);
  }

  let keysToHide =
    config.environment == "production" ? ["dsn", "jwtSecret"] : null;
  log.info({ event: "config.loaded", config: replaceKeys(config, keysToHide) });
}

function replaceKeys(config, keyList) {
  if (!keyList) return config;
  const cfg = { ...config };

  for (const key of keyList) {
    if (cfg[key]) {
      cfg[key] = "******";
    }
  }
  return cfg;
}
