import {
  useApolloClient,
  gql,
  useSubscription,
  useQuery,
} from "@apollo/client";
import React, { useState, useEffect, useRef } from "react";
import { useParams, Redirect, Link } from "react-router-dom";
import useNotificationContext from "../../contexts/NotificationContext/NotificationContext";
import useUserContext from "../../UserContext";
import { LinkWithCopy } from "../../atoms/LinkWithCopy";
import { Spinner } from "../../atoms/Spinner";

import "./style.scss";

export default function Component({ defaultJoinCode }) {
  const params = useParams();
  const [rendered, setRendered] = useState(<p>Loading...</p>);
  const [joinCode, setJoinCode] = useState(defaultJoinCode);

  useEffect(() => {
    const localStorageCode = localStorage.getItem("currentLobbyJoinCode");
    if (params.joinCode) {
      setJoinCode(params.joinCode);
    } else if (localStorageCode) {
      setJoinCode(localStorageCode);
    }
  }, [params]);

  if (!joinCode) {
    if (localStorage.getItem("currentLobbyJoinCode")) return null;
    else return <CreateLobbyButton />;
  }

  return (
    <div>
      <LobbyController joinCode={joinCode} />
    </div>
  );
}

const LobbyController = ({ joinCode }) => {
  const { data, loading, error, refetch } = useQuery(
    gql`
      query Lobby($joinCode: String!) {
        lobby(joinCode: $joinCode) {
          uuid
          joinCode
          createdAt
          nextGameSettings {
            uuid
            tracksToGuess
            trackList {
              name
            }
          }
          users {
            uuid
            createdAt
            name
          }
          games {
            uuid
            joinCode
            endAt
            startAt
            createdAt
            users {
              uuid
              name
              createdAt
              score
            }
            tracks {
              name
            }
          }
        }
      }
    `,
    {
      variables: {
        joinCode: joinCode,
      },
      fetchPolicy: "no-cache",
    }
  );

  if (loading || !data) return <Spinner />;
  if (error)
    return (
      <>
        <p>{JSON.stringify(error)}</p>
        <CreateLobbyButton />
      </>
    );

  return (
    <>
      <LobbyDisplay lobby={data.lobby} />
      <LobbyEventProcessor lobby={data.lobby} refetch={refetch} />
      <GamePrepareSection lobby={data.lobby} />
    </>
  );
};

const LobbyDisplay = ({ lobby }) => {
  const [user, _] = useUserContext();
  const apolloClient = useApolloClient();
  const [isPartOfLobby, setIsPartOfLobby] = useState(null);

  useEffect(() => {
    if (!lobby.users) return;
    for (let i = 0; i < lobby.users.length; i++) {
      if (lobby.users[i].uuid === user.data.userUuid) {
        setIsPartOfLobby(true);
        return;
      }
    }
    setIsPartOfLobby(false);
  }, [lobby.users, user.data.userUuid]);

  if (!lobby) return null;
  const currentLobbyJoinCode = localStorage.getItem("currentLobbyJoinCode");

  return (
    <div className="lobby__section">
      {/* <p>Lobby UUID: {lobby.uuid}</p> */}
      <h1>
        Lobby{" "}
        <LinkWithCopy
          text={lobby.joinCode}
          localUrl={`/lobby/${lobby.joinCode}`}
          bigSize="2.5rem"
          smallSize="1.5rem"
        />{" "}
        <CreateLobbyButton />{" "}
        {currentLobbyJoinCode === lobby.joinCode ? (
          <button
            onClick={() => {
              localStorage.setItem("currentLobbyJoinCode", "");
              setTimeout(() => {
                window.location.reload();
              }, 200);
            }}
          >
            Detach lobby
          </button>
        ) : (
          <button
            onClick={() => {
              localStorage.setItem("currentLobbyJoinCode", lobby.joinCode);
              setTimeout(() => {
                window.location.reload();
              }, 200);
            }}
          >
            Attach lobby to session
          </button>
        )}
      </h1>
      <h3>Players</h3>
      {lobby.users && (
        <PlayerList
          players={lobby.users}
          userUuid={user && user.data && user.data.userUuid}
        />
      )}
      {isPartOfLobby ? null : (
        <button
          onClick={async () => {
            await JoinLobby({ apolloClient, joinCode: lobby.joinCode });
          }}
        >
          Join lobby
        </button>
      )}
      {/* <p>
        Lobby invite code :{" "}
        <Link
          to={`/lobby/${lobby.joinCode}`}
          style={{ color: "white", textDecoration: "none" }}
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(
              `http://localhost:3000/lobby/${lobby.joinCode}`
            );
          }}
        >
          <span
            className="join-code"
            style={{ fontSize: "1.5rem", textDecoration: "underline" }}
          >
            {lobby.joinCode}
          </span>
          <span style={{ textDecoration: "none" }}>
            {" "}
            <i className="fas fa-clipboard" style={{ fontSize: "1rem" }} />
          </span>
        </Link>
      </p> */}
      {!isPartOfLobby || !lobby.games || lobby.games.length <= 0 ? null : (
        <>
          <h3>Games</h3>
          <GameList
            games={lobby.games}
            userUuid={user && user.data && user.data.userUuid}
          />
        </>
      )}
    </div>
  );
};

const PlayerList = ({ players, userUuid }) => {
  const [sortedPlayers, setSortedPlayers] = useState(null);

  useEffect(() => {
    if (!players) return;
    let newSortedPlayers = [...players];
    newSortedPlayers.sort((a, b) => {
      if (a.createdAt) {
        if (!b.createdAt && b.createdAt < a.createdAt) return -1;
        else return 1;
      } else if (a.uuid) {
        if (!b.uuid && b.uuid < a.uuid) return -1;
        else return 1;
      }
      return 1;
    });
    setSortedPlayers(newSortedPlayers);
  }, [players]);
  if (!sortedPlayers) return null;
  return sortedPlayers.map((player) => (
    <PlayerItemDisplay key={player.uuid} player={player} userUuid={userUuid} />
  ));
};

const PlayerItemDisplay = ({ player, userUuid }) => {
  return (
    <>
      <span>- {player.name}</span>
      <br />
    </>
  );
};

const GameList = ({ games, userUuid }) => {
  const [sortedGames, setSortedGames] = useState(null);

  useEffect(() => {
    if (!games) return;
    let newSortedGames = [...games];
    newSortedGames.sort((a, b) => {
      if (a.endAt) {
        if (!b.endAt && b.endAt < a.endAt) return -1;
        else return 1;
      } else if (a.startAt) {
        if (!b.startAt && b.startAt < a.startAt) return -1;
        else return 1;
      } else if (a.createdAt) {
        if (!b.createdAt && b.createdAt < a.createdAt) return -1;
        else return 1;
      }
      return 1;
    });
    setSortedGames(newSortedGames);
  }, [games]);
  if (!sortedGames) return null;
  return (
    <div>
      {sortedGames.map((game) => (
        <GameItemDisplay key={game.uuid} game={game} userUuid={userUuid} />
      ))}
    </div>
  );
};

const GameItemDisplay = ({ game, userUuid }) => {
  const [tailDisplay, setTailDisplay] = useState(null);
  const [isPartOfGame, setIsPartOfGame] = useState(null);
  const apolloClient = useApolloClient();

  const [sortedUsers, setSortedUsers] = useState([]);
  useEffect(() => {
    if (!game.users) {
      setSortedUsers([]);
      return;
    }
    let newSortedUsers = [...game.users];
    newSortedUsers.sort((a, b) => {
      return b.score !== a.score
        ? b.score - a.score
        : a.name.localeCompare(b.name);
    });
    setSortedUsers(newSortedUsers);
  }, [game.users]);

  useEffect(() => {
    if (!game.users || !userUuid) return;
    for (let i = 0; i < game.users.length; i++) {
      if (game.users[i].uuid === userUuid) {
        setIsPartOfGame(true);
        return;
      }
    }
    setIsPartOfGame(false);
  }, [game.users, userUuid]);

  useEffect(() => {
    const gameEnded = game.endAt && new Date(+game.endAt) < new Date();
    const gameStarted = game.startAt && new Date(+game.startAt) < new Date();

    setTailDisplay(
      <>
        {!gameEnded && gameStarted && (
          <>
            <i className="fas fa-clock" /> started{" "}
            {millisecondsToStr(new Date() - new Date(+game.startAt))} ago{" "}
          </>
        )}
        {!gameEnded && isPartOfGame && (
          <Link
            to={`/game/${game.joinCode}`}
            style={{ color: "#474747", textDecoration: "none" }}
          >
            <button>View game</button>
          </Link>
        )}
        {!gameEnded && !isPartOfGame && (
          <button
            onClick={async () => {
              await JoinGame({ apolloClient, joinCode: game.joinCode });
            }}
          >
            Join game
          </button>
        )}
        {gameEnded && (
          <span>
            <i className="fas fa-trophy" />{" "}
            {sortedUsers
              .slice(0, 3)
              .map(
                (gameUser, i) =>
                  `${i + 1}. ${gameUser.name} (${gameUser.score})`
              )
              .join(" ")}
          </span>
        )}
      </>
    );
  }, [apolloClient, game, isPartOfGame, sortedUsers]);

  return (
    <div>
      -{" "}
      <LinkWithCopy localUrl={`/game/${game.joinCode}`} text={game.joinCode} />{" "}
      <i className="fas fa-user-friends" />{" "}
      {!game.users ? 0 : game.users.length} <i className="fas fa-music" />{" "}
      {!game.tracks ? 0 : game.tracks.length} {tailDisplay}
    </div>
  );
};

const LobbyEventProcessor = ({ lobby, refetch }) => {
  const [_, notificationDispatch] = useNotificationContext();
  const [user, __] = useUserContext();
  const { data, loading } = useSubscription(
    gql`
      subscription OnLobbyEvent($lobbyUuid: ID) {
        lobbyEvent(lobbyUuid: $lobbyUuid) {
          kind
          userUuid
          userName
        }
      }
    `,
    {
      variables: {
        lobbyUuid: lobby.uuid,
      },
    }
  );
  useEffect(() => {
    if (!data) return;
    console.log({
      event: "lobbyEventProcessor.newEvent",
      kind: data.lobbyEvent ? data.lobbyEvent.kind : null,
    });
    let notificationConfig = null;
    if (data.lobbyEvent) {
      notificationConfig = {
        type: "default",
        message: `Event: ${data.lobbyEvent.kind}`,
      };
      switch (data.lobbyEvent.kind.toUpperCase()) {
        case "NEW_TRACKS":
          notificationConfig.message =
            "New tracks have been added to the lobby's track list !";
          break;
        case "USER_JOINED":
          if (data.lobbyEvent.userUuid == user.data.userUuid) {
            notificationConfig = null;
          } else {
            notificationConfig.message = `${
              data.lobbyEvent.userName || "Someone"
            } joined the lobby !`;
          }
          break;
        default:
          break;
      }
    }
    if (notificationConfig) {
      notificationDispatch({
        action: "SHOW_NOTIFICATION",
        notification: notificationConfig,
      });
    }
    refetch();
  }, [data, refetch, notificationDispatch]);

  if (loading || !data || !data.lobbyEvent || !data.lobbyEvent.kind)
    return null;
  // return <p>Last event: {data.lobbyEvent.kind}</p>;
  return null;
};

const CreateLobbyButton = () => {
  const [data, setData] = useState(null);
  const [triggered, setTrigerred] = useState(false);
  const button = (
    <button
      onClick={() => {
        setData(<CreateLobby />);
      }}
    >
      Create a new lobby
    </button>
  );

  return (
    <>
      {button}
      {data}
    </>
  );
};

export const CreateLobby = ({ shouldRedirect = true }) => {
  const [rendered, setRendered] = useState(
    <Spinner style={{ width: "1rem" }} />
  );
  const apolloClient = useApolloClient();
  const [user, userDispatch] = useUserContext();

  useEffect(() => {
    apolloClient
      .mutate({
        mutation: gql`
          mutation CreateLobby($userUuidList: [String]) {
            createLobby(userUuidList: $userUuidList) {
              joinCode
            }
          }
        `,
        variables: {
          userUuidList: [user.data.userUuid],
        },
      })
      .then((data) => {
        setRendered(JSON.stringify(data));
        if (
          shouldRedirect &&
          data.data &&
          data.data.createLobby &&
          data.data.createLobby.joinCode
        ) {
          localStorage.setItem(
            "currentLobbyJoinCode",
            data.data.createLobby.joinCode
          );
          setRendered(
            <Redirect to={`/lobby/${data.data.createLobby.joinCode}`} />
          );
        }
      })
      .catch((e) => {
        setRendered(JSON.stringify(e));
      });
  }, [apolloClient, user, shouldRedirect]);

  return <>{rendered}</>;
};

const GamePrepareSection = ({ lobby }) => {
  const [pickedPlaylistUuid, setPickedPlaylistUuid] = useState(null);
  const apolloClient = useApolloClient();

  let startSection = null;
  if (
    lobby.nextGameSettings &&
    lobby.nextGameSettings.tracksToGuess &&
    lobby.nextGameSettings.trackList &&
    lobby.nextGameSettings.trackList.length >=
      lobby.nextGameSettings.tracksToGuess
  ) {
    startSection = (
      <button
        onClick={async () => {
          await CreateGameFromLobby({
            apolloClient,
            lobby,
          });
        }}
      >
        Create game
      </button>
    );
  }
  return (
    <>
      {!lobby.nextGameSettings ? null : (
        <>
          <h3>Create new game</h3>
          <div>
            Settings: <i className="fas fa-music" />{" "}
            {lobby.nextGameSettings.tracksToGuess} tracks to guess
            <br />
            Game playlist:{" "}
            {lobby.nextGameSettings.trackList
              ? lobby.nextGameSettings.trackList.length
              : 0}{" "}
            total selected tracks.
            <br />
            Add tracks from a playlist: &nbsp;
            <PlaylistPicker
              setPickedPlaylistUuid={setPickedPlaylistUuid}
              lobbyUuid={lobby.uuid}
            />{" "}
            <br />
            Add tracks in common between all lobby members:{" "}
            <button
              onClick={() => {
                AddFriendsMatchToLobbyTracks({
                  apolloClient,
                  lobbyUuid: lobby.uuid,
                });
              }}
            >
              Add common tracks
            </button>
          </div>
        </>
      )}
      <p></p>
      {startSection}
    </>
  );
};

const PlaylistPicker = ({ setPickedPlaylistUuid, lobbyUuid }) => {
  const apolloClient = useApolloClient();
  const [searchResults, setSearchResults] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [updateSearchResultsTimeout, setUpdateSearchResultsTimeout] = useState(
    null
  );
  const inputRef = useRef(null);
  const updateSearchResults = (query) => {
    console.log({ msg: "triggering search results update" });
    apolloClient
      .query({
        query: gql`
          query SearchPlaylists($query: String) {
            searchPlaylists(query: $query) {
              uuid
              name
              pictureUrl
            }
          }
        `,
        variables: {
          query,
        },
      })
      .then((data) => setSearchResults(data.data.searchPlaylists))
      .catch((error) =>
        console.log({ msg: "error searching playlists", error })
      );
  };

  useEffect(() => {
    if (!selectedItem || !selectedItem.uuid) {
      setPickedPlaylistUuid(null);
      return;
    }
    setPickedPlaylistUuid(selectedItem.uuid);
  }, [selectedItem, setPickedPlaylistUuid]);

  return (
    <form
      style={{ display: "inline" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (
          inputRef.current.value.indexOf(
            "https://open.spotify.com/playlist/" != -1
          )
        ) {
          AddPlaylistToLobbyTracks({
            apolloClient,
            playlistUuid: inputRef.current.value,
            lobbyUuid: lobbyUuid,
          });
        }
      }}
    >
      <input
        type="text"
        name="search"
        autoComplete="off"
        placeholder="Playlist name or URL"
        ref={inputRef}
        onChange={(e) => {
          if (updateSearchResultsTimeout) {
            clearTimeout(updateSearchResultsTimeout);
          }
          setUpdateSearchResultsTimeout(
            setTimeout(() => {
              updateSearchResults(e.target.value);
            }, 250)
          );
        }}
        style={{ outline: "none" }}
      />
      {!selectedItem ? (
        !searchResults || searchResults.length <= 0 ? null : (
          <>
            <h4>Select a playlist:</h4>
            <ul className="search-result__list">
              {searchResults.map((result) => (
                <li
                  className="search-result__item"
                  onClick={async () => {
                    await AddPlaylistToLobbyTracks({
                      apolloClient,
                      playlistUuid: result.uuid,
                      lobbyUuid,
                    });
                    setSearchResults([]);
                    inputRef.current.value = "";
                    // setSelectedItem(result);
                  }}
                >
                  {/* <img
                    src={result.pictureUrl}
                    style={{ width: "4rem", marginRight: "0.5rem" }}
                    alt=""
                  /> */}
                  {result.name}
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <p>
          Selected: {selectedItem.name}{" "}
          <button
            onClick={() => {
              setSelectedItem(null);
            }}
          >
            Change
          </button>
        </p>
      )}
    </form>
  );
};

const JoinLobby = async ({ apolloClient, joinCode }) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation JoinLobby($joinCode: String!) {
        joinLobby(joinCode: $joinCode) {
          uuid
          name
        }
      }
    `,
    variables: {
      joinCode,
    },
  });
};

const JoinGame = async ({ apolloClient, joinCode }) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation JoinGame($joinCode: String!) {
        joinGame(joinCode: $joinCode) {
          uuid
          name
        }
      }
    `,
    variables: {
      joinCode,
    },
  });
};

const CreateGameFromLobby = async ({ apolloClient, lobby }) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation CreateGameFromSettings(
        $userUuidList: [ID]
        $gameSettingsUuid: ID
        $lobbyUuid: ID
      ) {
        createGameFromSettings(
          userUuidList: $userUuidList
          gameSettingsUuid: $gameSettingsUuid
          lobbyUuid: $lobbyUuid
        ) {
          uuid
          joinCode
        }
      }
    `,
    variables: {
      gameSettingsUuid: lobby.nextGameSettings.uuid,
      lobbyUuid: lobby.uuid,
      userUuidList: lobby.users.map((user) => user.uuid),
    },
  });
};

const AddPlaylistToLobbyTracks = async ({
  apolloClient,
  playlistUuid,
  lobbyUuid,
}) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation PlaylistToLobbyTracks($playlistUuid: ID, $lobbyUuid: ID) {
        playlistToLobbyTracks(
          playlistUuid: $playlistUuid
          lobbyUuid: $lobbyUuid
        ) {
          name
        }
      }
    `,
    variables: {
      playlistUuid,
      lobbyUuid,
    },
  });
};

const AddFriendsMatchToLobbyTracks = async ({ apolloClient, lobbyUuid }) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation FriendsMatchToLobbyTracks($lobbyUuid: ID) {
        friendsMatchToLobbyTracks(lobbyUuid: $lobbyUuid) {
          name
        }
      }
    `,
    variables: {
      lobbyUuid,
    },
  });
};

function millisecondsToStr(milliseconds) {
  // TIP: to find current time in milliseconds, use:
  // var  current_time_milliseconds = new Date().getTime();

  function numberEnding(number) {
    return number > 1 ? "s" : "";
  }

  var temp = Math.floor(milliseconds / 1000);
  var years = Math.floor(temp / 31536000);
  if (years) {
    return years + " year" + numberEnding(years);
  }
  //TODO: Months! Maybe weeks?
  var days = Math.floor((temp %= 31536000) / 86400);
  if (days) {
    return days + " day" + numberEnding(days);
  }
  var hours = Math.floor((temp %= 86400) / 3600);
  if (hours) {
    return hours + " hour" + numberEnding(hours);
  }
  var minutes = Math.floor((temp %= 3600) / 60);
  if (minutes) {
    return minutes + " minute" + numberEnding(minutes);
  }
  var seconds = temp % 60;
  if (seconds) {
    return seconds + " second" + numberEnding(seconds);
  }
  return "less than a second"; //'just now' //or other string you like;
}
