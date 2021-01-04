import axios from "axios";
import { log } from "../../core/log.js";
import { config } from "../../core/config.js";
import qs from "querystring";

export const makeGameTrackFromSpotifyTrack = (spotifyTrack) => {
  if (!spotifyTrack || !spotifyTrack.preview_url || !spotifyTrack.name) {
    throw new Error("MALFORMED_TRACK");
  }

  return {
    provider: "spotify",
    url: spotifyTrack.id,
    previewUrl: spotifyTrack.preview_url,
    pictureUrl: !spotifyTrack.images ? null : spotifyTrack.images[0].url,
    name: spotifyTrack.name,
    artists: spotifyTrack.artists.map((artist) => {
      return {
        provider: "spotify",
        name: artist.name,
      };
    }),
  };
};

export const refreshSpotifyAuth = async (user) => {
  const spotifyAuth = await user.getSpotifyAuth();
  if (!spotifyAuth) throw Error("NEED_AUTH");

  const data = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({
      grant_type: "refresh_token",
      refresh_token: spotifyAuth.refreshToken,
    }),
    {
      headers: {
        Authorization: config.spotifyClientAuthorizationHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  spotifyAuth.accessToken = data.data.access_token;
  spotifyAuth.accessTokenExpiresAt =
    Date.now() + data.data.expires_in * 1000 - 1000;
  spotifyAuth.scope = data.data.scope;
  await spotifyAuth.save();
};

export const makeSpotifyClient = async (user, refreshTokenIfNeeded = true) => {
  const spotifyAuth = await user.getSpotifyAuth();
  if (!spotifyAuth) throw Error("NEED_AUTH");

  if (spotifyAuth.accessTokenExpiresAt <= Date.now()) {
    log.error({ msg: "TOKEN IS EXPIRED" });
    if (refreshTokenIfNeeded) {
      await refreshSpotifyAuth(user);
      return await makeSpotifyClient(user, false);
    } else {
      throw Error("TOKEN_EXPIRED");
    }
  }

  let axiosClient = axios.create({
    headers: {
      Authorization: `Bearer ${spotifyAuth.accessToken}`,
    },
  });
  return axiosClient;
};

export const requestSpotify = (axiosClient, opts) => {
  return new Promise(async (resolve, reject) => {
    const maxRetry = 50;
    for (let retry = 0; retry < maxRetry; retry++) {
      try {
        const resp = await axiosClient(opts);
        if (!resp) reject(`missing_response resp=${JSON.stringify(resp)}`);
        resolve(resp);
        return;
      } catch (e) {
        if (e && e.response && e.response.status == 429) {
          const timeStart = Date.now() / 1000;
          let watchGuard = 0;
          log.info({
            msg: "429",
            retryAfter: e.response.headers["retry-after"],
            timeStart,
            url: opts.url,
          });
          while (
            Date.now() / 1000 <=
            timeStart + parseInt(e.response.headers["retry-after"]) + 1
          ) {
            watchGuard += 0.0001;
            if (watchGuard >= 2000) break;
            if (watchGuard == 100) {
              log.info({ msg: "watchGuard low" });
            }
          }
        } else {
          reject(e);
          return;
        }
      }
    }
    reject("too_many_retries");
    return;
  });
};

export const fetchAll = (axiosClient, requestOpts, { limit = 50 }, forEach) => {
  return new Promise(async (resolve, reject) => {
    let offset = 0;
    let globalTotal = 0;
    let processedItems = 0;
    let resp;
    const originUrl = requestOpts.url;
    try {
      requestOpts.url = originUrl + "?" + qs.stringify({ limit, offset });
      resp = await requestSpotify(axiosClient, requestOpts);
    } catch (e) {
      reject(e);
      return;
    }
    log.info({ data: resp.data });
    let items = resp.data.items ? resp.data.items : resp.data.tracks.items;
    let total = 0;
    if (resp.data.total) total = resp.data.total;
    else if (resp.data.tracks) total = resp.data.tracks.total;
    else if (resp.data.playlists) total = resp.data.playlists.total;
    else if (resp.data.artists) total = resp.data.artists.total;

    for (let i = 0; i < items.length; i++) {
      processedItems++;
      await forEach(items[i]);
    }
    globalTotal += total;
    log.info({ url: requestOpts.url, globalTotal, processedItems });
    while (processedItems.length < total) {
      offset += 100;
      try {
        requestOpts.url = originUrl + "?" + qs.stringify({ limit, offset });
        resp = await requestSpotify(axiosClient, requestOpts);
        for (let i = 0; i < items.length; i++) {
          processedItems++;
          await forEach(items[i]);
        }
      } catch (e) {
        log.error({ e: e.response.headers });
      }
      if (resp.status == 429) {
        log.info({ retryAfter: resp.headers["retry-after"] });
      }
    }
    log.info({ url: requestOpts.url, globalTotal, processedItems });
    resolve();
    return;
  });
};
