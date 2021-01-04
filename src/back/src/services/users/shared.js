import axios from "axios";
import qs from "qs";
import { log } from "../../core/log.js";
import {
  Playlist,
  UserKnownPlaylist,
  Track,
  UserKnownTrack,
  Artist,
  ArtistOwnedTrack,
} from "./models.js";
import { v4 as uuid } from "uuid";
import { fetchAll, makeSpotifyClient } from "../../addons/spotify/spotify.js";
import {
  games as gamePubSub,
  gameStorage,
} from "./resolvers/subscriptions/gameEvent.js";

import { lobbys as lobbyPubSub } from "./resolvers/subscriptions/lobbyEvent.js";
import { DELAY_SONG_SECONDS } from "./resolvers/mutations/proposeAnswer.js";

export const goToNextTrack = async (game, answeredBy = null) => {
  if (gameStorage[game.uuid] && gameStorage[game.uuid].nextTrackTimeout) {
    clearTimeout(gameStorage[game.uuid].nextTrackTimeout);
  }
  if (game.currentTrackIndex >= game.tracks.length - 1) {
    // if no more songs, end of the game
    finishGame(game);
    return;
  }

  if (game.currentTrackIndex == -1) {
    game.startAt = Date.now();
  }
  game.currentTrackIndex++;
  game.nextTrackAt = Date.now() + DELAY_SONG_SECONDS * 1000;
  await game.save();

  if (!gameStorage[game.uuid]) gameStorage[game.uuid] = {};
  gameStorage[game.uuid].nextTrackTimeout = setTimeout(() => {
    log.info({ msg: "auto next track !" });
    goToNextTrack(game);
  }, DELAY_SONG_SECONDS * 1000);

  gamePubSub[game.uuid].publish("GAME_UPDATE", {
    gameEvent: {
      kind: "next_track",
      answeredBy,
    },
  });

  const lobby = await game.getLobby();
  if (lobby && lobby.uuid) {
    lobbyPubSub[lobby.uuid].publish("GAME_UPDATE", {
      gameEvent: {
        kind: "next_track",
      },
    });
  }
};

export const finishGame = async (game) => {
  game.endAt = Date.now();
  await game.save();

  await gamePubSub[game.uuid].publish("GAME_UPDATE", {
    gameEvent: {
      kind: "game_finished",
    },
  });
};

export async function spotifySyncTracks(user) {
  let axiosClient = await makeSpotifyClient(user);
  // const MAX_TRACKS = 200;
  // let currentTracks = 0;
  try {
    await fetchAll(
      axiosClient,
      {
        url: "https://api.spotify.com/v1/me/playlists",
        method: "get",
      },
      {
        limit: 50,
      },
      async (playlist) => {
        await updatePlaylist({ playlist, user });
        await fetchAll(
          axiosClient,
          {
            url: `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          },
          {
            limit: 100,
          },
          async (track) => {
            // currentTracks++;
            // if (currentTracks >= MAX_TRACKS) throw new Error("MAX_TRACKS");
            await updateTrack({ track, user });
          }
        );
      }
    );
  } catch (e) {
    let ctx = {};
    if (e.response && e.response.headers) ctx.headers = e.response.headers;
    if (e.response && e.response.data.error) ctx.error = e.response.data.error;
    if (!e.response) ctx = e;
    log.error({ ctx });
  }
}

const updatePlaylist = async ({ playlist, user }) => {
  if (!playlist.id || !playlist.name) return;
  log.info({ event: "spotify.playlist.sync", playlistId: playlist.id });
  let p;
  const existingPlaylist = await Playlist.findOne({
    where: {
      provider: "spotify",
      url: playlist.id,
    },
  });
  // const playlistImage = !playlist.images ? null : playlist.images[0].url;
  if (existingPlaylist) {
    p = existingPlaylist;
    p.name = playlist.name;
    // if (playlistImage) p.pictureUrl = playlistImage;
    await p.save();
  } else {
    try {
      p = await Playlist.create({
        uuid: uuid(),
        provider: "spotify",
        url: playlist.id,
        name: playlist.name,
        // pictureUrl: playlistImage,
      });
    } catch (e) {
      if (!e.type || e.type != "unique violation") throw e;
    }
  }
  let knownPlaylist = await UserKnownPlaylist.findOne({
    where: {
      playlistId: p.id,
      userId: user.id,
    },
  });
  if (!knownPlaylist) {
    knownPlaylist = await UserKnownPlaylist.create({
      uuid: uuid(),
      playlistId: p.id,
      userId: user.id,
    });
  }
};

const updateTrack = async ({ track, user }) => {
  if (
    !track.track ||
    !track.track.id ||
    !track.track.name ||
    !track.track.preview_url
  )
    return;
  log.info({ event: "spotify.track.sync", trackId: track.track.id });
  let t;
  const existingTrack = await Track.findOne({
    where: {
      provider: "spotify",
      url: track.track.id,
    },
  });
  const trackImage = !track.track.images ? null : track.track.images[0].url;
  if (existingTrack) {
    t = existingTrack;
    t.name = track.track.name;
    t.previewUrl = track.track.preview_url;
    if (trackImage) t.pictureUrl = trackImage;
    await t.save();
  } else {
    try {
      t = await Track.create({
        uuid: uuid(),
        provider: "spotify",
        url: track.track.id,
        previewUrl: track.track.preview_url,
        pictureUrl: !track.track.images ? null : track.track.images[0].url,
        name: track.track.name,
      });
    } catch (e) {
      if (!e.type || e.type != "unique violation") throw e;
      log.warn({
        event: "spotify.track.sync.conflict",
        reason: "unique_violation",
        msg: "retrying",
      });
      return await updateTrack({ track, user });
    }
  }
  let knownTrack = await UserKnownTrack.findOne({
    where: {
      trackId: t.id,
      userId: user.id,
    },
  });
  if (!knownTrack) {
    knownTrack = await UserKnownTrack.create({
      uuid: uuid(),
      trackId: t.id,
      userId: user.id,
    });
  }

  for (let i = 0; i < track.track.artists.length; i++) {
    let a;
    const existingArtist = await Artist.findOne({
      where: {
        provider: "spotify",
        url: track.track.artists[i].id,
      },
    });
    if (existingArtist) {
      a = existingArtist;
      if (a.name != track.track.artists[i].name) {
        a.name = track.track.artists[i].name;
        await a.save();
      }
    } else {
      try {
        a = await Artist.create({
          uuid: uuid(),
          provider: "spotify",
          url: track.track.artists[i].id,
          name: track.track.artists[i].name,
        });
      } catch (e) {
        if (!e.type || e.type != "unique violation") throw e;
        log.warn({
          event: "spotify.track.sync.conflict",
          reason: "unique_violation",
        });
        return await updateTrack({ track, user });
      }
    }
    let ownedTrack = await ArtistOwnedTrack.findOne({
      where: {
        trackId: t.id,
        artistId: a.id,
      },
    });
    if (!ownedTrack) {
      try {
        ownedTrack = await ArtistOwnedTrack.create({
          uuid: uuid(),
          trackId: t.id,
          artistId: a.id,
        });
      } catch (e) {
        if (!e.type || e.type != "unique violation") throw e;
        log.warn({
          event: "spotify.track.sync.conflict",
          reason: "unique_violation",
        });
        return await updateTrack({ track, user });
      }
    }
  }
};
