import apolloPkg from "apollo-server";
const { PubSub } = apolloPkg;
import sequelizePkg from "sequelize";
const { Op } = sequelizePkg;
import { Game } from "../../models.js";
import { log } from "../../../../core/log.js";

import { goToNextTrack } from "../../shared.js";

export let games = {};
export let gameStorage = {};
export default ({ ForbiddenError, ApolloError, uuid, withFilter }) => {
  return {
    name: "gameEvent",
    // handler: (_, { gameUuid }) => {
    handler: {
      subscribe: withFilter(
        (_, { gameUuid }, __) => {
          log.info({ gameUuid });
          if (!games[gameUuid]) throw new ForbiddenError("MISSING_PUBSUB");

          const iterator = games[gameUuid].asyncIterator([
            "GAME_UPDATE",
            "ANSWER_ACCEPTED",
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
  log.info({ event: "pubsub.game.init" });
  games = {};
  gameStorage = {};
  const items = await Game.findAll({
    where: {
      endAt: {
        [Op.or]: [{ [Op.gte]: Date.now() }, { [Op.eq]: null }],
      },
    },
  });
  items.forEach((game) => {
    games[game.uuid] = new PubSub();
    gameStorage[game.uuid] = {};
    if (game.nextTrackAt) {
      const newDelay = new Date(game.nextTrackAt) - new Date();
      log.info({ msg: "restoring timeout", newDelay });
      gameStorage[game.uuid].nextTrackTimeout = setTimeout(() => {
        log.info({ msg: "auto next track !" });
        goToNextTrack(game);
      }, newDelay);
    }
  });
};
