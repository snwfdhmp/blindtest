import {
  UserKnownTrack,
  User,
  Track,
  Game,
  GameUser,
  Artist,
} from "../../models.js";
import { log } from "../../../../core/log.js";
const JOIN_CODE_LENGTH = 6;
import { v4 as uuid } from "uuid";
import apolloPkg from "apollo-server";
const { PubSub } = apolloPkg;
import { games as gamePubSub } from "../subscriptions/gameEvent.js";

export default ({ sequelize, UserInputError, models }) => {
  return {
    name: "createGame",
    handler: async (
      _,
      { userUuidList, tracks, lobbyUuid, numberOfTracks = 30 }
    ) => {
      let users = [];
      for (let i = 0; i < userUuidList.length; i++) {
        const user = await User.findOne({ where: { uuid: userUuidList[i] } });
        if (!user) throw new UserInputError("USER_NOT_FOUND");
        users.push(user);
      }

      let lobby;
      if (lobbyUuid) {
        lobby = await models.Lobby.findOne({
          where: {
            uuid: lobbyUuid,
          },
        });
        if (!lobby) throw new UserInputError("LOBBY_NOT_FOUND");
      }

      tracks = pickRandomTracks(tracks, numberOfTracks);

      let newGameData = {
        uuid: uuid(),
        joinCode: makeJoinCode(),
        startAt: Date.now() + 5000,
        tracks: tracks,
      };
      if (lobby) newGameData.lobbyId = lobby.id;
      const newGame = await Game.create(newGameData);

      for (let i = 0; i < users.length; i++) {
        await GameUser.create({
          uuid: uuid(),
          userId: users[i].id,
          gameId: newGame.id,
        });
      }

      gamePubSub[newGame.uuid] = new PubSub();

      return newGame;
    },
  };
};

const pickRandomTracks = (tracks, howMany) => {
  const processArr = [...tracks];
  let pickedTracks = [];
  for (let i = 0; i < howMany && i < processArr.length; i++) {
    pickedTracks.push(
      processArr.splice(Math.random() * processArr.length, 1)[0]
    );
  }
  return pickedTracks;
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

const matchFriendsTracks = async ({ userIdList, sequelize }) => {
  const timeStart = Date.now();
  const selectQuery =
    userIdList
      .map(
        (user) =>
          `select track_id from user_known_tracks where user_id=${user.id}`
      )
      .join(" intersect ") + ";";
  const data = await sequelize.query(selectQuery);
  return data[0];
};

const pickTracks = ({ trackList, numberOfTracks }) =>
  shuffle([...trackList]).slice(0, numberOfTracks - 1);

function shuffle(a) {
  var j, x, i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
}
