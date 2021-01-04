import { ForbiddenError } from "apollo-server";
import { lobbys as lobbyPubSub } from "../subscriptions/lobbyEvent.js";

export default ({ models, AuthenticationError, log, uuid }) => {
  return {
    name: "joinLobby",
    handler: async (_, { joinCode }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const lobby = await models.Lobby.findOne({
        where: {
          joinCode: joinCode,
        },
      });
      if (!lobby) throw new ForbiddenError("NOT_FOUND");

      const existing = await models.LobbyUser.findOne({
        where: {
          lobbyId: lobby.id,
          userId: user.id,
        },
      });
      if (existing) throw new ForbiddenError("ALREADY_JOINED");

      const lobbyUser = await models.LobbyUser.create({
        uuid: uuid(),
        lobbyId: lobby.id,
        userId: user.id,
      });

      lobbyPubSub[lobby.uuid].publish("LOBBY_UPDATE", {
        lobbyEvent: {
          kind: "USER_JOINED",
          userUuid: user.uuid,
          userName: user.name,
        },
      });

      return lobbyUser;
    },
  };
};
