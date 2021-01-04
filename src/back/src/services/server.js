import sequelizePkg from "sequelize";
const { Sequelize, Op } = sequelizePkg;
const QueryTypes = Sequelize.QueryTypes;

import bcrypt from "bcrypt";
const BCRYPT_SALT_ROUNDS = 12;
import express from "express";
import jwt from "jsonwebtoken";
import util from "util";
import { exec } from "child_process";
import { v4 as uuid } from "uuid";
import bodyParser from "body-parser";
import Axios from "axios";
import qs from "querystring";
import { SpotifyAuth, User } from "./users/models.js";
import { spotifySyncTracks } from "./users/shared.js";
import { createServer } from "http";
import { execute, subscribe } from "graphql";
import { SubscriptionServer } from "subscriptions-transport-ws";
import { initPubSub as initLobbysPubSub } from "./users/resolvers/subscriptions/lobbyEvent.js";
import { initPubSub as initGamesPubSub } from "./users/resolvers/subscriptions/gameEvent.js";

import apolloServerPkg from "apollo-server-express";
const {
  ApolloServer,
  ApolloError,
  AuthenticationError,
  ForbiddenError,
  UserInputError,
  PubSub,
  makeExecutableSchema,
  withFilter,
} = apolloServerPkg;

import { config } from "../core/config.js";
import { log } from "../core/log.js";
import {
  makeRefreshToken,
  makeAccessToken,
  verifyAndDecodeToken,
} from "./users/resolvers/queries/authenticate.js";
// import { seed } from "../testdata/seed.js";
// import { backupBucket } from "../addons/bucket/bucket.js";
// import * as emails from "../addons/emails/emails.js";
// import * as emailTemplates from "../addons/emails/emailTemplates.js";

// import {
//   DiscordBot,
//   info as discordInfo,
//   init as discordInit,
// } from "../addons/discord/discord.js";

const BACKEND_SERVICES = ["users"];
const SERVER_HOST = "0.0.0.0";

import fs from "fs";
import path from "path";
import { responsePathAsArray } from "graphql";
const readFile = util.promisify(fs.readFile);
let lastBackupTime = 0;

const commonIds = {
  id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
  uuid: { type: Sequelize.UUID, allowNull: false },
};

export class Server {
  sequelizeModelsDefaultParams = {
    underscored: true,
  };
  apolloServer = null;
  sequelize = null;

  async init({ dsn, eventsToWaitFor = [] }) {
    const timeStart = Date.now();
    // init db
    this.sequelize = new Sequelize(dsn, {
      underscored: true,
      dialect: "postgres",
      logging: () => {},
      // logging: (text) => {
      //   log.log({ logAuthor: "sequelize.sql", message: text });
      // },
    });
    this.sequelizeModelsDefaultParams.sequelize = this.sequelize;

    while (true) {
      try {
        await this.sequelize.authenticate();
        break;
      } catch (e) {
        log.error({
          event: "db.connection.failed",
          msg: "Retrying db connection",
          e,
        });
        const wait = () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve();
            }, 1000);
          });
        };
        await wait();
      }
    }

    eventsToWaitFor.push(...["db.sync.done", "graphql.init.done"]);
    // if (!config.disableSeeding) eventsToWaitFor.push("db.seed.done");
    runWhenBoth(eventsToWaitFor, () => {
      // this.apolloServer.listen(({ url, subscriptionUrl }) => {
      //   log.info({ url, subscriptionUrl });
      // });
      this.httpServer = createServer(this.expressApp);
      this.httpServer.listen(config.serverPort, () => {
        new SubscriptionServer(this.subscriptionServerConfig, {
          server: this.httpServer,
          path: "/subscriptions",
        });
        log.initSentry();
        log.success({
          event: "server.listening",
          port: config.serverPort,
          version: config.version,
          timeSpent: Date.now() - timeStart + "ms",
        });
        if (
          config.flexlabEnvironment !== "development" ||
          config.flexlabEnvironment == "development"
        ) {
          let delay = 14400000;
          if (
            config.flexlabEnvironment == "production" ||
            config.flexlabEnvironment == "development"
          ) {
            delay = 3600000;
          }
          setInterval(() => {
            doBackup();
          }, delay);

          let sigtermAlreadyReceived = false;
          process.on("SIGTERM", function () {
            if (sigtermAlreadyReceived) return;
            sigtermAlreadyReceived = true;
            // steps below should not be mandatory for terminating, because not every shutdown will be graceful
            doBackup(async () => {
              await log.success({ event: "server.shutdown.successful" });
              setTimeout(() => process.exit(0), 1000);
            });
            log.info({
              event: "server.shutdown.requested",
            });
          });
        }
      });
    });

    this.initDb({
      onModelsInitDone: () => this.initApollo(),
    });

    return this.apolloServer;
  }

  createExpressApp() {
    const newApp = express();

    newApp.use(function (req, res, next) {
      res.setHeader("Version", config.version);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      next();
    });

    newApp.use(bodyParser.json());

    newApp.get("/", (req, res) => {
      res.send({ status: "ok" });
    });

    newApp.get("/version", (req, res) => {
      res.send(JSON.stringify({ version: config.version }));
    });

    newApp.get("/restart", (req, res) => {
      res.send(JSON.stringify({ status: "ok" }));
      process.kill(process.pid, "SIGTERM");
    });

    const spotifyLoginEndpoint = "/spotify-login";
    newApp.get(spotifyLoginEndpoint, function (req, res) {
      var scopes =
        "user-read-private user-read-email user-library-read user-follow-read playlist-read-collaborative playlist-read-private streaming app-remote-control user-read-currently-playing user-read-playback-state user-top-read user-read-recently-played user-read-playback-position";
      if (!req.headers["redirect-uri"]) {
        res.status(400);
        res.send({ reason: "REDIRECT_URI_HEADER_NEEDED" });
        return;
      }
      const redirectUri = req.headers["redirect-uri"];
      log.info({ event: "connect.spotify.request", redirectUri });
      res.send({
        redirect:
          "https://accounts.spotify.com/authorize" +
          "?response_type=code" +
          "&client_id=" +
          config.spotifyClientId +
          (scopes ? "&scope=" + encodeURIComponent(scopes) : "") +
          "&redirect_uri=" +
          encodeURIComponent(redirectUri),
      });
    });

    const spotifyLoginCallbackEndpoint = "/spotify-login/callback";
    newApp.post(spotifyLoginCallbackEndpoint, function (req, res) {
      if (!req.headers["redirect-uri"]) {
        res.status(400);
        res.send({ reason: "REDIRECT_URI_HEADER_NEEDED" });
        return;
      }
      const redirectUri = req.headers["redirect-uri"];
      if (!req.body || !req.body.code) {
        log.error({
          event: "connect.spotify.callback.fail",
          reason: "Missing code.",
        });
        res.status(400);
        res.send({ reason: "MISSING_CODE" });
        return;
      }
      log.info({ event: "connect.spotify.callback", redirectUri });
      const code = req.body.code;
      log.info({ code });
      Axios.post(
        "https://accounts.spotify.com/api/token",
        qs.stringify({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            Authorization: config.spotifyClientAuthorizationHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )
        .then(async (data) => {
          let user;
          if (!req.headers.Authorization) {
            const resp = await Axios.get("https://api.spotify.com/v1/me", {
              headers: {
                Authorization: `Bearer ${data.data.access_token}`,
              },
            });
            const existingUser = await User.findOne({
              where: {
                email: resp.data.email,
              },
            });
            if (existingUser) {
              user = existingUser;
            } else {
              user = await User.create({
                uuid: uuid(),
                name: resp.data.display_name || resp.data.email,
                email: resp.data.email,
                accountActivatedAt: Date.now(),
              });
            }
          } else {
            const token = req.headers.Authorization.replace("Bearer ", "");
            if (!token) {
              res.status(401);
              res.send({ error: "Bad Authorization header." });
              return;
            }
            const decodedToken = verifyAndDecodeToken(token);
            client = await User.findOne({
              where: {
                uuid: decodedToken.identity.userUuid,
              },
            });
          }
          const spotifyAuth = await SpotifyAuth.create({
            uuid: uuid(),
            refreshToken: data.data.refresh_token,
            accessToken: data.data.access_token,
            scope: data.data.scope,
            accessTokenExpiresAt: Date.now() + data.data.expires_in - 1,
          });
          await user.setSpotifyAuth(spotifyAuth);
          spotifySyncTracks(user);
          const refreshToken = makeRefreshToken(user.uuid);
          const accessToken = await makeAccessToken(refreshToken);
          res.send({
            identity: user,
            spotifyAuth: spotifyAuth.uuid,
            refreshToken,
            accessToken,
          });
        })
        .catch((e) => {
          log.error({ e: e, response: e.response });
        });
    });

    // const backupToken = `1961c84a414f66e55fc8198539f8dd5e9f698be30805fc9bad4e7f5b634b4168`;
    // newApp.get("/do-backup", (req, res) => {
    //   if (req.header("Authorization") != `Token ${backupToken}`) {
    //     res.status(401).send({ status: "UNAUTHORIZED" });
    //     return;
    //   }
    //   log.info({ event: "backup.requested", from: "api", by: "header" });
    //   doBackup();
    //   res.send({ status: "OK" });
    // });

    // newApp.get(`/do-backup-token/${backupToken}`, (req, res) => {
    //   log.info({ event: "backup.requested", from: "api", by: "route" });
    //   doBackup();
    //   res.send({ status: "OK" });
    // });

    // newApp.get("/last-backup-time", (req, res) => {
    //   res.send(JSON.stringify({ timestamp: lastBackupTime }));
    // });

    return newApp;
  }

  async callResolver(type, name, args, context) {
    return await this.resolvers[type][name](null, args, context);
  }

  async initDb({ onModelsInitDone }) {
    let services = [];
    process.on("db.models.init", () => {
      BACKEND_SERVICES.map((service) => {
        const importPath = "./" + service + "/models.js";
        import(importPath)
          .then(async (service) => {
            // console.log({ service })
            services.push(service);
            await service.initModels({
              commonIds,
              defaultParams: this.sequelizeModelsDefaultParams,
            });
            process.emit("db.models.init.done");
          })
          .catch((e) => {
            log.error({ error: e, service: service });
            process.exit(1);
          });
      });
    });

    // init db models
    let dbInitDone = false;
    process.on("db.models.init.done", async () => {
      if (services.length != BACKEND_SERVICES.length || dbInitDone) {
        return;
      }
      dbInitDone = true;

      const timeStart = Date.now();
      for (const service of services) {
        await service.initAssociations({});
      }

      log.info({
        event: "db.models.init.done",
        timeSpent: Date.now() - timeStart + "ms",
      });
      onModelsInitDone && onModelsInitDone();
      process.emit("db.sync");
    });

    process.on("db.seed", async () => {
      // await seed();
    });

    process.on("db.sync", async () => {
      const timeStart = Date.now();
      try {
        await this.sequelize.sync({
          force: config.dbForceSync,
        });

        initGamesPubSub();
        initLobbysPubSub();

        if (!config.disableSeeding) process.emit("db.seed");

        const sequelizeSyncDoneEvent = "db.sync.done";
        await log.info({
          event: sequelizeSyncDoneEvent,
          timeSpent: Date.now() - timeStart + "ms",
        });
        process.emit(sequelizeSyncDoneEvent);
      } catch (e) {
        const sequelizeSyncFailEvent = "db.sync.fail";
        await log.error({ event: sequelizeSyncFailEvent, e });
        process.emit(sequelizeSyncFailEvent);
      }
    });

    process.emit("db.models.init");
  }

  async initApollo() {
    const timeStart = Date.now();
    let resolvers = {
      Query: {},
      Mutation: {},
      Subscription: {},
    };

    const context = {
      sequelize: this.sequelize,
      models: this.sequelize.models,
      QueryTypes,
      Op,
      log,
      // emails,
      // DiscordBot,
      // emailTemplates,
      bcrypt,
      jwt,
      config,
      ApolloError,
      AuthenticationError,
      ForbiddenError,
      UserInputError,
      PubSub,
      BCRYPT_SALT_ROUNDS,
      uuid,
      withFilter,
    };

    let allFiles = { queries: [], mutations: [], subscriptions: [] };
    for (const service of BACKEND_SERVICES) {
      let files;

      const basePathSubscriptions = `./${service}/resolvers/subscriptions`;
      const fullPathSubscriptions = path.join(
        "./src/services",
        basePathSubscriptions
      );
      files = fs.readdirSync(fullPathSubscriptions);
      for (const file of files) {
        import("./" + path.join(basePathSubscriptions, file)).then(
          (resolverModule) => {
            const resolver = resolverModule.default(context);
            resolvers.Subscription[resolver.name] = resolver.handler;
          }
        );
      }
      allFiles.subscriptions.push(...files);

      const basePathQueries = `./${service}/resolvers/queries`;
      const fullPathQueries = path.join("./src/services", basePathQueries);
      files = fs.readdirSync(fullPathQueries);
      for (const file of files) {
        import("./" + path.join(basePathQueries, file)).then(
          (resolverModule) => {
            const resolver = resolverModule.default(context);
            // resolvers.Query[resolver.name] = resolver.handler;
            resolvers.Query[resolver.name] = resolver.handler; // new code to avoid writting 'name' property in resolvers definition
          }
        );
      }
      allFiles.queries.push(...files);

      const basePathMutations = `./${service}/resolvers/mutations`;
      const fullPathMutations = path.join("./src/services", basePathMutations);
      files = fs.readdirSync(fullPathMutations);
      for (const file of files) {
        import("./" + path.join(basePathMutations, file)).then(
          (resolverModule) => {
            const resolver = resolverModule.default(context);
            resolvers.Mutation[resolver.name] = resolver.handler;
          }
        );
      }
      allFiles.mutations.push(...files);

      // The following code is a deprecated behavior, it should be deleted once
      // the deletion is confirmed not to break anything. Delete after: 26/11/20
      //
      // import(importPath)
      //   .then(serviceResolvers => {
      //     serviceResolvers.getQueryResolvers &&
      //       Object.assign(resolvers.Query, serviceResolvers.getQueryResolvers(context))
      //     serviceResolvers.getMutationResolvers &&
      //       Object.assign(resolvers.Mutation, serviceResolvers.getMutationResolvers(context))
      //   })
      //   .catch(e => {
      //     log.warn({ error: e, service: service })
      //   })
    }

    let typeDefs = [
      // (await readFile("./src/services/common.graphql")).toString(),
    ];
    for (let i = 0; i < BACKEND_SERVICES.length; i++) {
      typeDefs.push(
        (
          await readFile(
            "./src/services/" + BACKEND_SERVICES[i] + "/schema.graphql"
          )
        ).toString()
      );
    }

    setTimeout(() => {
      this.apolloServer = new ApolloServer({
        typeDefs,
        resolvers,
        subscriptions: {
          onConnect: (connectionParams, webSocket) => {
            // if (connectionParams.authToken) {
            //   return validateToken(connectionParams.authToken)
            //     .then(findUser(connectionParams.authToken))
            //     .then((user) => {
            //       return {
            //         currentUser: user,
            //       };
            //     });
            // }
            // throw new Error("Missing auth token!");
          },
        },
        formatError: (err) => {
          log.log({ path: err.path, error: err }, "error-returned");
          if (config.flexlabEnvironment == "production") {
            err.message = "";
            delete err.extensions.exception;
          }

          return err;
        },
        context: ({ req }) => {
          const auth = req.headers.authorization;
          const token = auth && auth.split("Bearer ")[1];
          if (!token) {
            return {};
          }

          let secretToUse = null;
          const authKind = req.get("Authorization-Kind");
          if (authKind == "jwt/merchant") {
            secretToUse = config.jwtSecret + "-merchant";
          } else if (authKind == "jwt/staff") {
            secretToUse = config.jwtSecret + "-staff";
          } else {
            secretToUse = config.jwtSecret;
          }

          let context = {};
          try {
            context = {
              auth: jwt.verify(token, secretToUse, { algorithm: "HS512" }),
            };
            log.info({ event: "apollo.context.creation.success", context });
          } catch (e) {
            log.error({ error: e, event: "apollo.context.creation.failed" });
            throw new AuthenticationError();
            return {};
          }

          return context;
        },
      });
      const schema = makeExecutableSchema({ typeDefs, resolvers });
      this.subscriptionServerConfig = {
        execute,
        subscribe,
        schema,
      };
      this.expressApp = this.createExpressApp();
      this.apolloServer.applyMiddleware({
        app: this.expressApp,
        path: "/graphql",
      });
      log.info({
        event: "graphql.init.done",
        timeSpent: Date.now() - timeStart + "ms",
      });
      process.emit("graphql.init.done");
      // discordInit();
      this.resolvers = resolvers;
    }, 1000);
  }
}
export const server = new Server();

function runWhenBoth(eventList, callback) {
  let callbackCalled = false;

  let waitEventsData = {};
  eventList.map((event) => {
    waitEventsData[event] = true;
  });

  for (let event in waitEventsData) {
    process.on(event, () => {
      waitEventsData[event] = false;
      if (
        eventList.every((val) => {
          return waitEventsData[val] === false;
        })
      ) {
        if (!callbackCalled) {
          callbackCalled = true;
          callback();
        } else {
          log.warn({
            event: "server.init.warning",
            kind: "weird",
            msg: "server ready more than once",
          });
        }
      }
    });
  }
}

export function doBackup(callback) {
  // const timeStart = Date.now();
  // exec("/bin/sh ./src/bin/backup.sh", async (error, stdout, stderr) => {
  //   try {
  //     // Uploads a local file to the bucket
  //     await backupBucket.upload(stdout, {
  //       // Support for HTTP requests made with `Accept-Encoding: gzip`
  //       gzip: true,
  //       // By setting the option `destination`, you can change the name of the
  //       // object you are uploading to a bucket.
  //       metadata: {
  //         // Enable long-lived HTTP caching headers
  //         // Use only if the contents of the file will never change
  //         // (If the contents will change, use cacheControl: 'no-cache')
  //         cacheControl: "public, max-age=31536000",
  //       },
  //       destination: `${
  //         config.flexlabEnvironment || "undefined"
  //       }/${path.basename(stdout)}`,
  //     });
  //     await log.info({
  //       event: "backup.success",
  //       timeSpent: Date.now() - timeStart + "ms",
  //     });
  //     await DiscordBot.log("Backup succeeded");
  //     lastBackupTime = Date.now();
  //     callback && callback();
  //   } catch (e) {
  //     await log.info({
  //       event: "backup.failed",
  //       error: e,
  //       timeSpent: Date.now() - timeStart + "ms",
  //     });
  //     await DiscordBot.error(
  //       `${DiscordBot.getUserId("mjo")} Backup failed: ${e}`
  //     );
  //     callback && callback();
  //     return;
  //   }
  // });
}
