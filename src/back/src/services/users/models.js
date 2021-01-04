import pkg from "sequelize";
const { Sequelize } = pkg;
const Model = Sequelize.Model;
import { initPubSub as initGamesPubSub } from "./resolvers/subscriptions/gameEvent.js";

export class User extends Model {}
export class Track extends Model {}
export class UserKnownTrack extends Model {}
export class SpotifyAuth extends Model {}
export class UserKnownPlaylist extends Model {}
export class Playlist extends Model {}
export class Artist extends Model {}
export class ArtistOwnedTrack extends Model {}
export class Game extends Model {}
export class GameUser extends Model {}
export class GameSettings extends Model {}
export class Lobby extends Model {}
export class LobbyUser extends Model {}

export function initAssociations() {
  ArtistOwnedTrack.belongsTo(Artist, { as: "artist" });
  ArtistOwnedTrack.belongsTo(Track, { as: "track" });
  Track.belongsToMany(Artist, {
    as: "artists",
    through: ArtistOwnedTrack,
  });

  UserKnownTrack.belongsTo(User, { as: "user" });
  UserKnownTrack.belongsTo(Track, { as: "track" });

  User.hasMany(UserKnownTrack, { as: "knownTracks" });
  Track.hasMany(UserKnownTrack, { as: "knownUsers" });

  UserKnownPlaylist.belongsTo(User, { as: "user" });
  UserKnownPlaylist.belongsTo(UserKnownPlaylist, { as: "playlist" });

  GameUser.belongsTo(User, { as: "user" });
  GameUser.belongsTo(Game, { as: "game" });
  Game.belongsToMany(User, { as: "users", through: GameUser });
  Game.hasMany(GameUser, { as: "gameUsers" });
  Game.belongsTo(GameSettings, { as: "settings" });
  Game.belongsTo(Lobby, { as: "lobby" });

  LobbyUser.belongsTo(User, { as: "user" });
  LobbyUser.belongsTo(Lobby, { as: "lobby" });
  User.belongsToMany(Lobby, { as: "lobbies", through: LobbyUser });
  Lobby.belongsToMany(User, { as: "users", through: LobbyUser });
  Lobby.belongsTo(GameSettings, { as: "nextGameSettings" });
  Lobby.hasMany(Game, { as: "games" });

  User.hasMany(UserKnownPlaylist, { as: "knownPlaylists" });
  Playlist.hasMany(UserKnownPlaylist, { as: "knownUsers" });

  SpotifyAuth.belongsTo(User, { as: "user" });
  User.hasOne(SpotifyAuth, { as: "spotifyAuth" });
}

export function initModels({ commonIds, defaultParams }) {
  User.init(
    {
      ...commonIds,
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      accountActivationToken: { type: Sequelize.STRING },
      accountActivatedAt: { type: Sequelize.DATE },
      accountDisabledAt: { type: Sequelize.DATE },
      password: { type: Sequelize.STRING },
      passwordUpdatedAt: { type: Sequelize.DATE },
      lastLoggedIn: { type: Sequelize.DATE },
    },
    {
      ...defaultParams,
    }
  );

  Game.init(
    {
      ...commonIds,
      joinCode: { type: Sequelize.STRING, allowNull: false, unique: true },
      startAt: { type: Sequelize.DATE },
      endAt: { type: Sequelize.DATE },
      tracks: { type: Sequelize.JSONB },
      nextTrackAt: { type: Sequelize.DATE },
      currentTrackIndex: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: -1,
      },
    },
    {
      ...defaultParams,
    }
  );

  GameUser.init(
    {
      ...commonIds,
      score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      ...defaultParams,
    }
  );

  Lobby.init(
    {
      ...commonIds,
      joinCode: { type: Sequelize.STRING, allowNull: false, unique: true },
      tracks: { type: Sequelize.JSONB },
    },
    {
      ...defaultParams,
    }
  );

  GameSettings.init(
    {
      ...commonIds,
      tracksToGuess: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      trackList: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    },
    {
      ...defaultParams,
    }
  );

  LobbyUser.init(
    {
      ...commonIds,
      score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      ...defaultParams,
    }
  );

  Playlist.init(
    {
      ...commonIds,
      provider: {
        type: Sequelize.ENUM("spotify", "raw_url"),
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      url: { type: Sequelize.STRING, allowNull: false, unique: true },
      pictureUrl: { type: Sequelize.STRING },
    },
    {
      ...defaultParams,
    }
  );

  Artist.init(
    {
      ...commonIds,
      provider: {
        type: Sequelize.ENUM("spotify", "raw_url"),
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      url: { type: Sequelize.STRING, allowNull: false, unique: true },
    },
    {
      ...defaultParams,
    }
  );

  Track.init(
    {
      ...commonIds,
      provider: {
        type: Sequelize.ENUM("spotify", "raw_url"),
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      url: { type: Sequelize.STRING, allowNull: false, unique: true },
      pictureUrl: { type: Sequelize.STRING },
      previewUrl: { type: Sequelize.STRING },
    },
    {
      ...defaultParams,
    }
  );

  UserKnownPlaylist.init(
    {
      ...commonIds,
    },
    {
      ...defaultParams,
    }
  );

  UserKnownTrack.init(
    {
      ...commonIds,
      numberOfStreams: { type: Sequelize.INTEGER },
    },
    {
      ...defaultParams,
    }
  );

  ArtistOwnedTrack.init(
    {
      ...commonIds,
    },
    {
      ...defaultParams,
    }
  );

  SpotifyAuth.init(
    {
      ...commonIds,
      accessToken: { type: Sequelize.STRING },
      refreshToken: { type: Sequelize.STRING, allowNull: false },
      accessTokenExpiresAt: { type: Sequelize.DATE },
      scope: { type: Sequelize.STRING(1024) },
    },
    {
      ...defaultParams,
    }
  );
}
