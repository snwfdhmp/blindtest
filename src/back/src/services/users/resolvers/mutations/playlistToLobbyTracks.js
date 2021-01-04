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

export default ({ sequelize, UserInputError, models, ApolloError }) => {
  return {
    name: "playlistToLobbyTracks",
    handler: async (_, { playlistUuid, lobbyUuid }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      let lobby;
      if (lobbyUuid) {
        lobby = await models.Lobby.findOne({
          where: {
            uuid: lobbyUuid,
          },
          include: [{ model: models.GameSettings, as: "nextGameSettings" }],
        });
        if (!lobby) throw new UserInputError("LOBBY_NOT_FOUND");
      }

      let playlist;
      if (playlistUuid) {
        if (playlistUuid.indexOf("https://open.spotify.com/playlist/") != -1) {
          playlist = {
            provider: "spotify",
            url: playlistUuid
              .replace("https://open.spotify.com/playlist/", "")
              .replace(/\?.*$/, ""),
          };
        } else {
          playlist = await models.Playlist.findOne({
            where: {
              uuid: playlistUuid,
            },
          });
        }
        if (!playlist) throw new UserInputError("PLAYLIST_NOT_FOUND");
      }

      let tracks = [];
      switch (playlist.provider) {
        case "spotify":
          let existingIdCache = {};
          lobby.nextGameSettings.trackList.forEach((track) => {
            if (track.provider == "spotify") {
              existingIdCache[track.url] = true;
            }
          });
          let spotifyClient = await makeSpotifyClient(user);
          await fetchAll(
            spotifyClient,
            {
              url: `https://api.spotify.com/v1/playlists/${playlist.url}/tracks`,
            },
            {
              limit: 100,
            },
            async (data) => {
              try {
                let track;
                if (
                  !data.preview_url &&
                  (!data.track || !data.track.preview_url)
                ) {
                  const newData = await requestSpotify(spotifyClient, {
                    url: `https://api.spotify.com/v1/tracks/${data.track.id}`,
                  });
                  track = makeGameTrackFromSpotifyTrack(newData.track);
                } else {
                  track = makeGameTrackFromSpotifyTrack(data.track);
                }
                if (!existingIdCache[track.url]) tracks.push(track);
              } catch (e) {
                log.warn({
                  event: "lobby.playlistToLobbyTracks.error",
                  track: data.track,
                  e,
                });
              }
            }
          );
          break;

        default:
          throw new ApolloError("UNSUPPORTED_PLAYLIST_PROVIDER");
          break;
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
