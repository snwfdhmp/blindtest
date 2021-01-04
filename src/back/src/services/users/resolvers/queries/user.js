export default ({ models, ForbiddenError }) => {
  return {
    name: "user",
    handler: async (parent, { userUuid }, context) => {
      if (!userUuid) {
        if (!context.auth.identity) {
          throw new ForbiddenError();
        }

        userUuid = context.auth.identity.userUuid;
      }

      const user = await models.User.findOne({
        where: { uuid: userUuid },
      });

      return user;
    },
  };
};
