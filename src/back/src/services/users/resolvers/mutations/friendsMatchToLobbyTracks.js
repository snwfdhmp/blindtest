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
import apolloPkg, { ApolloError } from "apollo-server";
const { PubSub } = apolloPkg;
import { lobbys as lobbyPubSub } from "../subscriptions/lobbyEvent.js";
import {
  fetchAll,
  makeSpotifyClient,
  makeGameTrackFromSpotifyTrack,
  requestSpotify,
} from "../../../../addons/spotify/spotify.js";

export default ({
  sequelize,
  AuthenticationError,
  UserInputError,
  models,
  ApolloError,
}) => {
  return {
    name: "friendsMatchToLobbyTracks",
    handler: async (_, { lobbyUuid }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let lobby;
      if (!lobbyUuid) {
        throw new UserInputError("MISSING_LOBBY_UUID");
      }
      lobby = await models.Lobby.findOne({
        where: {
          uuid: lobbyUuid,
        },
        include: [
          {
            model: models.User,
            as: "users",
          },
          { model: models.GameSettings, as: "nextGameSettings" },
        ],
      });
      if (!lobby) throw new UserInputError("LOBBY_NOT_FOUND");
      if (!lobby.users) throw new UserInputError("NO_USERS_IN_LOBBY");
      if (lobby.users.length < 2)
        throw new UserInputError("NOT_ENOUGH_USERS_IN_LOBBY");

      let existingIdCacheSpotify = {};
      lobby.nextGameSettings.trackList.forEach((track) => {
        if (track.provider == "spotify") {
          existingIdCacheSpotify[track.url] = true;
        }
      });

      let tracks = [];
      const trackIds = await matchFriendsTracks({
        userIdList: lobby.users,
        sequelize,
      });
      for (let i = 0; i < trackIds.length; i++) {
        const track = await models.Track.findOne({
          where: { id: trackIds[i].track_id },
          include: [{ model: models.Artist, as: "artists" }],
        });
        if (track.provider == "spotify" && existingIdCacheSpotify[track.url])
          continue;
        if (!track) {
          log.warn({ msg: "Weird: track not found but was found just before" });
          continue;
        }
        tracks.push(track);
      }

      lobby.nextGameSettings.trackList = [
        ...lobby.nextGameSettings.trackList,
        ...tracks,
      ];
      await lobby.nextGameSettings.save();

      lobbyPubSub[lobby.uuid].publish("LOBBY_UPDATE", {
        lobbyEvent: {
          kind: "new_tracks",
          tracks,
        },
      });

      log.info({ nextGameSettings: lobby.nextGameSettings });
      return tracks;
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
