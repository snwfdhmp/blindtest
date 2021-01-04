import { ForbiddenError } from "apollo-server";
import { games as gamePubSub } from "../subscriptions/gameEvent.js";
import { lobbys as lobbyPubSub } from "../subscriptions/lobbyEvent.js";

export default ({ models, AuthenticationError, log, uuid }) => {
  return {
    name: "joinGame",
    handler: async (_, { joinCode }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const game = await models.Game.findOne({
        where: {
          joinCode: joinCode,
        },
        include: [{ model: models.Lobby, as: "lobby" }],
      });
      if (!game) throw new ForbiddenError("NOT_FOUND");

      const existing = await models.GameUser.findOne({
        where: {
          gameId: game.id,
          userId: user.id,
        },
      });
      if (existing) throw new ForbiddenError("ALREADY_JOINED");

      const gameUser = await models.GameUser.create({
        uuid: uuid(),
        gameId: game.id,
        userId: user.id,
      });

      gamePubSub[game.uuid].publish("GAME_UPDATE", {
        gameEvent: {
          kind: "USER_JOINED",
          userUuid: user.uuid,
        },
      });

      if (game.lobby && game.lobby.uuid) {
        lobbyPubSub[game.lobby.uuid].publish("GAME_UPDATE", {
          gameEvent: {
            kind: "USER_JOINED",
            userUuid: user.uuid,
          },
        });
      }

      return gameUser;
    },
  };
};
