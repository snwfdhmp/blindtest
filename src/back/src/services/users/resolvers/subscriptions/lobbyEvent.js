import apolloPkg from "apollo-server";
const { PubSub } = apolloPkg;
import { Lobby } from "../../models.js";
import { log } from "../../../../core/log.js";

export let lobbys = {};
export default ({ ForbiddenError, ApolloError, uuid, withFilter }) => {
  return {
    name: "lobbyEvent",
    // handler: (_, { lobbyUuid }) => {
    handler: {
      subscribe: withFilter(
        (_, { lobbyUuid }, __) => {
          log.info({ lobbyUuid });
          if (!lobbys[lobbyUuid]) throw new ForbiddenError("MISSING_PUBSUB");

          const iterator = lobbys[lobbyUuid].asyncIterator([
            "LOBBY_UPDATE",
            "GAME_UPDATE",
          ]);
          // log.info({ iterator });
          return iterator;
        },
        (_, __, { user }) => {
          return true;
        }
      ),
    },
  };
};

export const initPubSub = async () => {
  log.info({ event: "pubsub.lobby.init" });
  lobbys = {};
  const items = await Lobby.findAll();
  items.forEach((lobby) => (lobbys[lobby.uuid] = new PubSub()));
};
