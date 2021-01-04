import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../../../../core/config.js";
import { User } from "../../models.js";

export default ({
  models,
  bcrypt,
  jwt,
  config,
  ForbiddenError,
  UserInputError,
  log,
  uuid,
}) => {
  return {
    name: "authenticate",
    handler: async (parent, { email, password, refreshToken }) => {
      if (
        (!refreshToken || refreshToken.length <= 0) &&
        (!password || password.length <= 0)
      ) {
        throw new UserInputError("NO_AUTHENTICATION_WAY_PROVIDED");
      }
      if (refreshToken) {
        try {
          const accessToken = await makeAccessToken(refreshToken);
          return {
            refreshToken,
            accessToken,
          };
        } catch (e) {
          if (!password && !email) throw new ForbiddenError();
          log.error({ event: "authenticate.refreshToken.failed", e });
        }
      }
      if (!password || password.length <= 0 || !email || email.length <= 0) {
        throw new ForbiddenError();
      }
      const challenge = await models.User.findOne({
        where: { email: email },
        attributes: ["id", "uuid", "password", "accountActivatedAt"],
      });
      if (challenge == null) return { error: "ACCOUNT_NOT_FOUND" };
      if (challenge.accountActivatedAt == null)
        return { error: "ACCOUNT_PENDING_ACTIVATION" };
      const passwordMatch = await bcrypt.compare(password, challenge.password);
      if (!passwordMatch) return { error: "WRONG_PASSWORD" };

      refreshToken = makeRefreshToken(challenge.uuid);
      const accessToken = await makeAccessToken(refreshToken);
      return {
        refreshToken: refreshToken,
        accessToken: accessToken,
      };
    },
  };
};

export const JWT_ALGORITHM = "HS512";

export const JWT_REFRESH_TOKEN_DURATION = "7d";
export const JWT_ACCESS_TOKEN_DURATION = "1d";

export function makeRefreshToken(userUuid) {
  return jwt.sign(
    {
      validFor: {
        userUuid: userUuid,
      },
    },
    config.jwtSecret,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_REFRESH_TOKEN_DURATION,
      notBefore: "0",
    }
  );
}

export async function verifyAndDecodeToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      config.jwtSecret,
      { algorithm: JWT_ALGORITHM },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );
  });
}

export async function makeAccessToken(refreshToken) {
  let decodedToken;
  try {
    decodedToken = await verifyAndDecodeToken(refreshToken);
  } catch (e) {
    throw new ForbiddenError();
  }
  if (!decodedToken) throw new ForbiddenError();

  const challenge = await User.findOne({
    where: { uuid: decodedToken.validFor.userUuid },
    attributes: [
      "id",
      "accountActivatedAt",
      "password",
      "uuid",
      "lastLoggedIn",
    ],
  });
  if (challenge == null) return { error: "ACCOUNT_NOT_FOUND" };

  const token = jwt.sign(
    {
      identity: {
        userUuid: challenge.uuid,
        lastLoggedIn: !challenge.lastLoggedIn
          ? null
          : challenge.lastLoggedIn.valueOf(),
      },
    },
    config.jwtSecret,
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_ACCESS_TOKEN_DURATION,
      notBefore: "0",
    }
  );

  challenge.lastLoggedIn = Date.now();
  await challenge.save();

  return token;
}
