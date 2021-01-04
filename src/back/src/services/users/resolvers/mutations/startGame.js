import { gameStorage } from "../subscriptions/gameEvent.js";
import { goToNextTrack } from "../../shared.js";

import { DELAY_SONG_SECONDS } from "./proposeAnswer.js";

export default ({ models, AuthenticationError, ForbiddenError }) => {
  return {
    name: "startGame",
    handler: async (_, { gameUuid }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let game;
      if (gameUuid) {
        game = await models.Game.findOne({
          where: {
            uuid: gameUuid,
          },
        });
        if (!game) throw new ForbiddenError("GAME_NOT_FOUND");
      }

      await goToNextTrack(game);

      return true;
    },
  };
};
