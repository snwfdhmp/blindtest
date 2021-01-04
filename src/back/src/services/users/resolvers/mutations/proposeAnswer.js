import { validate } from "graphql";
import { goToNextTrack } from "../../shared.js";
import { games as gamePubSub } from "../subscriptions/gameEvent.js";
import { log } from "../../../../core/log.js";

export const DELAY_SONG_SECONDS = 31;

export default ({
  models,
  UserInputError,
  ForbiddenError,
  AuthenticationError,
  ApolloError,
  log,
}) => {
  return {
    name: "proposeAnswer",
    handler: async (_, { gameUuid, trackIndex, answerText }, context) => {
      if (!context.auth || !context.auth.identity) throw new ForbiddenError();

      const user = await models.User.findOne({
        where: {
          uuid: context.auth.identity.userUuid,
        },
      });
      if (!user) throw new AuthenticationError();

      const game = await models.Game.findOne({
        where: {
          uuid: gameUuid,
        },
      });
      if (!game) throw new UserInputError("GAME_NOT_FOUND");

      const gameUser = await models.GameUser.findOne({
        where: {
          userId: user.id,
          gameId: game.id,
        },
      });
      if (!gameUser) throw new ForbiddenError("USER_IS_NOT_PART_OF_THE_GAME");

      if (trackIndex != game.currentTrackIndex)
        throw new ForbiddenError("WRONG_TRACK_INDEX");

      if (game.tracks[trackIndex].answeredBy)
        throw new ForbiddenError("ALREADY_ANSWERED");

      if (game.tracks.length <= trackIndex)
        throw new ApolloError("TRACK_INDEX_GT_TRACKS_LENGTH");

      const valid = validateAnswer(answerText, game.tracks[trackIndex]);
      if (!valid) {
        gameUser.score -= 4;
        await gameUser.save();
        gamePubSub[game.uuid].publish("GAME_UPDATE", {
          gameEvent: {
            kind: "ANSWER_REJECTED",
            userName: user.name,
            answerText: answerText,
          },
        });
        return false;
      }

      if (!gamePubSub[game.uuid]) throw new ApolloError("MISSING_PUBSUB");
      game.tracks[trackIndex].answeredBy = gameUser.uuid;
      await game.save();

      gameUser.score += 10;
      await gameUser.save();

      goToNextTrack(game, user.name);
      return true;
    },
  };
};

function cleanTrackName(string) {
  return removeAccents(string)
    .toLowerCase()
    .replace(/-.*$/, "")
    .replace(/[.\-|,;:()!?'"/+°#<>~*^¨@&]/g, "")
    .trim();
}

const removeAccents = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const validateAnswer = (answerText, track) => {
  answerText = answerText.toLowerCase();
  if (answerText == track.name.toLowerCase()) return true;
  let trackNameClean = cleanTrackName(track.name);
  log.info({ trackName: track.name, trackNameClean });
  if (
    answerText == trackNameClean ||
    cleanTrackName(answerText) == trackNameClean
  )
    return true;
  if (
    cleanTrackName(answerText) ==
    trackNameClean
      .replace(/ (.*)/g, "")
      .replace(/ \[.*\]/g, "")
      .trim("")
  )
    return true;

  if (track.artists) {
    for (let i = 0; i < track.artists.length; i++) {
      if (answerText == track.artists[i].name.toLowerCase()) return true;
      if (cleanTrackName(answerText) == cleanTrackName(track.artists[i].name))
        return true;
    }
  }

  return false;
};
