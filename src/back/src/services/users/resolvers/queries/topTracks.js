import axios from "axios";
import qs from "qs";
export default ({ models, AuthenticationError, log }) => {
  return {
    name: "topTracks",
    handler: async (_, { count = 50, timeRange = "long_term" }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const spotifyAuth = await user.getSpotifyAuth();
      if (!spotifyAuth) throw Error("NEED_AUTH");

      if (spotifyAuth.accessTokenExpiresAt <= Date.now()) {
        log.error({ msg: "TOKEN IS EXPIRED" });
        throw Error("TOKEN_EXPIRED");
      }

      let tracks = [];
      let offset = 0;
      while (tracks.length < count) {
        const resp = await axios.get(
          "https://api.spotify.com/v1/me/top/tracks?" +
            qs.stringify({
              limit: Math.max(50, count),
              offset,
              time_range: timeRange,
            }),
          {
            headers: {
              Authorization: `Bearer ${spotifyAuth.accessToken}`,
            },
          }
        );
        offset += 50;
        tracks.push(...resp.data.items);
        if (resp.data.total <= tracks.length) {
          if (resp.data.total < count)
            log.warn({ msg: `Not enough tracks: ${resp.data.total}/${count}` });
          break;
        }
      }
      return tracks;
    },
  };
};
