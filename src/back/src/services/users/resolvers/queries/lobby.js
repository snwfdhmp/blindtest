import { ForbiddenError } from "apollo-server";

export default ({
  models,
  AuthenticationError,
  ForbiddenError,
  log,
  sequelize,
}) => {
  return {
    name: "lobby",
    handler: async (_, { joinCode }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let lobby = await models.Lobby.findOne({
        where: {
          joinCode: joinCode,
        },
        include: [
          { model: models.User, as: "users" },
          {
            model: models.Game,
            as: "games",
            include: [
              {
                model: models.GameUser,
                as: "gameUsers",
                include: [{ model: models.User, as: "user" }],
              },
            ],
          },
          {
            model: models.GameSettings,
            as: "nextGameSettings",
          },
        ],
        order: [[{ model: models.Game, as: "games" }, "createdAt", "ASC"]],
      });
      if (!lobby) throw new ForbiddenError("NOT_FOUND");

      if (lobby.games) {
        for (let i = 0; i < lobby.games.length; i++) {
          if (lobby.games[i].gameUsers) {
            for (let j = 0; j < lobby.games[i].gameUsers.length; j++) {
              lobby.games[i].gameUsers[j].name =
                lobby.games[i].gameUsers[j].user.name;
              lobby.games[i].gameUsers[j].uuid =
                lobby.games[i].gameUsers[j].user.uuid;
            }

            lobby.games[i].users = lobby.games[i].gameUsers;
          }
        }
      }

      // log.info({ lobby });
      return lobby;
    },
  };
};
