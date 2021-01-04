import { ForbiddenError } from "apollo-server";

export default ({ models, AuthenticationError, ForbiddenError, log }) => {
  return {
    name: "game",
    handler: async (_, { joinCode }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let game = await models.Game.findOne({
        where: {
          joinCode: joinCode,
        },
        include: [
          {
            model: models.GameUser,
            as: "gameUsers",
            include: [{ model: models.User, as: "user" }],
          },
          {
            model: models.Lobby,
            as: "lobby",
          },
        ],
      });
      if (!game) throw new ForbiddenError("NOT_FOUND");

      for (let i = 0; i < game.gameUsers.length; i++) {
        game.gameUsers[i].name = game.gameUsers[i].user.name;
        game.gameUsers[i].uuid = game.gameUsers[i].user.uuid;
      }

      game.users = game.gameUsers;
      // log.info({ game });
      return game;
    },
  };
};
