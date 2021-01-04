export default ({ models, AuthenticationError, log, Op, sequelize }) => {
  return {
    name: "searchPlaylists",
    handler: async (_, { query }, context) => {
      if (!context.auth.identity.userUuid) throw new AuthenticationError();
      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const playlists = await models.Playlist.findAll({
        where: {
          name: {
            [Op.or]: [
              {
                [Op.iLike]: "%" + query.toLowerCase() + "%",
              },
              {
                [Op.iLike]: query.toLowerCase() + "%",
              },
              {
                [Op.iLike]: "%" + query.toLowerCase(),
              },
            ],
          },
        },
        limit: 10,
      });

      return playlists;
    },
  };
};
