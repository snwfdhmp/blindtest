import {
  useApolloClient,
  gql,
  useSubscription,
  useQuery,
} from "@apollo/client";
import React, { useState, useEffect } from "react";
import { useParams, Redirect } from "react-router-dom";
import useUserContext from "../../UserContext";

import "./style.scss";

export default function Component({ defaultJoinCode, displayShort = false }) {
  const params = useParams();
  const [rendered, setRendered] = useState(<p>Loading...</p>);
  const [joinCode, setJoinCode] = useState(defaultJoinCode);
  const localStorageCode = localStorage.getItem("currentLobbyJoinCode");

  useEffect(() => {
    if (params.joinCode) {
      setJoinCode(params.joinCode);
    } else if (localStorageCode) {
      setJoinCode(localStorageCode);
    }
  }, [params]);

  if (!joinCode) return <CreateLobbyButton />;
  return (
    <div>
      <LobbyController joinCode={joinCode} displayShort={displayShort} />
    </div>
  );
}

const LobbyController = ({ joinCode, displayShort = false }) => {
  const { data, loading, error, refetch } = useQuery(
    gql`
      query Lobby($joinCode: String!) {
        lobby(joinCode: $joinCode) {
          uuid
          joinCode
          users {
            uuid
            name
          }
        }
      }
    `,
    {
      variables: {
        joinCode: joinCode,
      },
    }
  );

  if (loading || !data) return <CreateLobbyButton />;
  if (error)
    return (
      <>
        <p>{JSON.stringify(error)}</p>
        <CreateLobbyButton />
      </>
    );

  return (
    <>
      {displayShort ? null : <CreateLobbyButton />}
      {displayShort ? (
        <LobbyDisplayShort lobby={data && data.lobby} />
      ) : (
        <LobbyDisplay lobby={data && data.lobby} />
      )}
      <LobbyEventProcessor lobby={data && data.lobby} refetch={refetch} />
      {displayShort ? null : <GamePrepareSection />}
    </>
  );
};

const LobbyDisplayShort = ({ lobby }) => {
  if (!lobby) return null;

  return (
    <div>
      <p>Lobby: {lobby.joinCode}</p>
      {lobby.users && <p>Players:</p>}
      {lobby.users &&
        lobby.users.map((user) => (
          <>
            &nbsp;&nbsp;{user.name}
            <br />
          </>
        ))}
      {/* <p>Raw: {JSON.stringify(lobby)}</p> */}
    </div>
  );
};

const LobbyDisplay = ({ lobby }) => {
  if (!lobby) return null;

  return (
    <div className="lobby__section">
      <p>Lobby UUID: {lobby.uuid}</p>
      <p>Join code: {lobby.joinCode}</p>
      {lobby.users && <h3>Players</h3>}
      {lobby.users && lobby.users.map((user) => <p>{user.name}</p>)}
      {/* <p>Raw: {JSON.stringify(lobby)}</p> */}
    </div>
  );
};

const LobbyEventProcessor = ({ lobby, refetch }) => {
  const { data, loading } = useSubscription(
    gql`
      subscription OnLobbyEvent($lobbyUuid: ID) {
        lobbyEvent(lobbyUuid: $lobbyUuid) {
          kind
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
      kind: data.lobbyEvent.kind,
    });
    switch (data.lobbyEvent.kind) {
      case "USER_JOINED":
        refetch();
        break;
      default:
        break;
    }
  }, [data, refetch]);

  if (loading || !data || !data.lobbyEvent || !data.lobbyEvent.kind)
    return null;
  return <p>Last event: {data.lobbyEvent.kind}</p>;
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
      Create lobby
    </button>
  );

  return (
    <>
      {button}
      {data}
    </>
  );
};

const CreateLobby = ({ requestUid, shouldRedirect = true }) => {
  const [rendered, setRendered] = useState(<p>Loading...</p>);
  const apolloClient = useApolloClient();
  const [user, userDispatch] = useUserContext();
  console.log({ userUuid: user.data.userUuid });
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

const GamePrepareSection = () => {
  const [pickedPlaylistUuid, setPickedPlaylistUuid] = useState(null);

  let startSection = null;
  if (pickedPlaylistUuid) {
    startSection = <button>Create game</button>;
  }
  return (
    <>
      <h2>Create a game</h2>
      <PlaylistPicker setPickedPlaylistUuid={setPickedPlaylistUuid} />
      {startSection}
    </>
  );
};

const PlaylistPicker = ({ setPickedPlaylistUuid }) => {
  const apolloClient = useApolloClient();
  const [searchResults, setSearchResults] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [updateSearchResultsTimeout, setUpdateSearchResultsTimeout] = useState(
    null
  );
  const updateSearchResults = (query) => {
    console.log({ msg: "triggering search results update" });
    apolloClient
      .query({
        query: gql`
          query SearchPlaylists($query: String) {
            searchPlaylists(query: $query) {
              uuid
              name
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
    <>
      <input
        type="text"
        name="search"
        autoComplete="off"
        placeholder="Playlist name"
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
          <ul>
            {searchResults.map((result) => (
              <li
                onClick={() => {
                  setSelectedItem(result);
                }}
              >
                {result.name}
              </li>
            ))}
          </ul>
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
    </>
  );
};

const CreateGame = async ({ apolloClient, playlistUuid }) => {
  apolloClient.mutate(gql`
    query CreateGame()
  `);
};
