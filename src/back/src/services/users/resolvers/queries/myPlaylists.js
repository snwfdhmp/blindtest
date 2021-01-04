export default ({ models, AuthenticationError, log }) => {
  return {
    name: "myPlaylists",
    handler: async (_, args, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const knownPlaylists = await models.UserKnownPlaylist.findAll({
        where: {
          userId: user.id,
        },
      });
      let playlists = [];
      for (let i = 0; i < knownPlaylists.length; i++) {
        playlists.push(
          await models.Playlist.findOne({
            where: {
              id: knownPlaylists[i].playlistId,
            },
          })
        );
      }
      return playlists;
    },
  };
};
