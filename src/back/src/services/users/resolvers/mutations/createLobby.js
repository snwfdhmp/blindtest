import {
  UserKnownTrack,
  User,
  Track,
  Lobby,
  LobbyUser,
  Artist,
} from "../../models.js";
import { log } from "../../../../core/log.js";
const JOIN_CODE_LENGTH = 6;
import { v4 as uuid } from "uuid";
import apolloPkg from "apollo-server";
const { PubSub } = apolloPkg;
import { lobbys as lobbyPubSub } from "../subscriptions/lobbyEvent.js";
import lobby from "../queries/lobby.js";

export default ({ sequelize, UserInputError, models }) => {
  return {
    name: "createLobby",
    handler: async (_, { userUuidList }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let users = [];
      for (let i = 0; i < userUuidList.length; i++) {
        const userItem = await User.findOne({
          where: { uuid: userUuidList[i] },
        });
        if (!userItem) throw new UserInputError("USER_NOT_FOUND");
        users.push(userItem);
      }

      const newLobby = await Lobby.create({
        uuid: uuid(),
        joinCode: makeJoinCode(),
      });

      const nextGameSettings = await models.GameSettings.create({
        uuid: uuid(),
      });
      await newLobby.setNextGameSettings(nextGameSettings);

      for (let i = 0; i < users.length; i++) {
        await LobbyUser.create({
          uuid: uuid(),
          userId: users[i].id,
          lobbyId: newLobby.id,
        });
      }

      lobbyPubSub[newLobby.uuid] = new PubSub();

      return {
        joinCode: newLobby.joinCode,
      };
    },
  };
};

function makeJoinCode(length = JOIN_CODE_LENGTH) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
