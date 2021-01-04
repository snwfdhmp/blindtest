import Sentry from "@sentry/node";
// import { info } from "../addons/discord/discord.js";
import { config } from "./config.js";
import colors from "colors";

const timeStart = Date.now();

export class Logger {
  constructor() {
    this.sentryInited = false;
  }

  async initSentry() {
    // if (!this.sentryInited) {
    //   Sentry.init({
    //     dsn:
    //       "",
    //     environment: config.flexlabEnvironment,
    //   });
    //   this.sentryInited = true;
    // }
  }

  async log(data, level = "info") {
    switch (config.environment) {
      case "production":
        if (typeof data == "string") {
          data = { message: data };
        }
        data.logTime = new Date().toISOString();
        data.level = level;
        data = JSON.stringify(data, null, 0);
        console.log(data);
        break;
      default:
        let cleanData = { ...data };
        let prefix = `${level.toUpperCase()}`;
        if (data.event) {
          prefix += ` ${data.event}`;
          delete cleanData.event;
        }
        if (data.error) {
          if (data.error.extensions.exception) {
            data.error.extensions.exception = JSON.stringify(
              data.error.extensions.exception,
              null,
              2
            );
          }
        }
        if (data.trackId) {
          prefix += ` track=${data.trackId}`;
          delete cleanData.trackId;
        }

        if (data.step) {
          prefix += ` ${data.step}`;
          delete cleanData.step;
        }
        if (data.timeSpent) {
          prefix += ` ${data.timeSpent.black.bold}`;
          delete cleanData.timeSpent;
        }

        switch (level) {
          case "info":
            prefix = prefix.blue;
            break;
          case "error":
            prefix = prefix.red.bold;
            break;
          case "warn":
            prefix = prefix.yellow;
            break;
          case "fatal":
            prefix = prefix.red.bold;
            break;
          case "success":
            prefix = prefix.green.bold;
            break;
        }

        const printData = cleanData && Object.keys(cleanData).length > 0;
        console.log(
          `[${prettyDuration(Date.now() - timeStart)}] ${prefix}${
            printData ? ":" : "."
          }`
        );
        printData && console.log(data);
        break;
    }
  }

  async info(data) {
    this.log(data, "info");
  }

  async warn(data) {
    this.log(data, "warn");
  }

  async error(data) {
    this.log(data, "error");
  }

  async fatal(data) {
    this.log(data, "fatal");
  }

  async success(data) {
    this.log(data, "success");
  }
}

export const log = new Logger();

function prettyDuration(ms) {
  const m = Math.floor(ms / 1000 / 60);
  const s = Math.floor((ms - m * 1000 * 60) / 1000);
  const remainingMs = ms - (m * 1000 * 60 + s * 1000);
  // return `${!m ? "" : `${m}m`}${!s ? "" : `${s}s`}${!remainingMs ? "" : `${remainingMs}ms`}`
  if (m) {
    return `${m}m:${s}s:${remainingMs}ms`;
  } else if (s) {
    return `${s}s:${remainingMs}ms`;
  }
  return `${remainingMs}ms`;
}
