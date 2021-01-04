import {
  useApolloClient,
  gql,
  useSubscription,
  useQuery,
} from "@apollo/client";
import React, { useState, useEffect, useRef } from "react";
import { useParams, Redirect, Link } from "react-router-dom";
import useUserContext from "../../UserContext";
import ReactAudioPlayer from "react-audio-player";
import Countdown from "react-countdown";
import useGameNotificationContext from "../../contexts/GameNotificationContext";
import { GameNotificationProvider } from "../../contexts/GameNotificationContext/GameNotificationContext";
import { Line, Circle } from "rc-progress";
import { v4 as uuid } from "uuid";

import "./style.scss";

const gameNotificationReducer = (state, payload) => {
  switch (payload.action) {
    case "SHOW_NOTIFICATION": {
      return { data: payload.notification };
    }

    case "HIDE_NOTIFICATION": {
      return { data: null };
    }

    default: {
      return { ...state };
    }
  }
};

export default function Component({ defaultJoinCode }) {
  const params = useParams();
  const [rendered, setRendered] = useState(<p>Loading...</p>);
  const [joinCode, setJoinCode] = useState(defaultJoinCode);

  useEffect(() => {
    if (params.joinCode) {
      setJoinCode(params.joinCode);
    }
  }, [params]);

  if (!joinCode) return <p>Missing join code</p>;
  return (
    <div>
      <GameController joinCode={joinCode} />
    </div>
  );
}

const GameController = ({ joinCode }) => {
  const { data, loading, error, refetch } = useQuery(
    gql`
      query Game($joinCode: String!) {
        game(joinCode: $joinCode) {
          uuid
          joinCode
          currentTrackIndex
          nextTrackAt
          endAt
          users {
            uuid
            name
            score
          }
          tracks {
            name
            previewUrl
            artists {
              name
            }
          }
          lobby {
            joinCode
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

  if (loading || !data) return <p>Loading...</p>;
  if (error)
    return (
      <>
        <p>{JSON.stringify(error)}</p>
      </>
    );

  return (
    <>
      <GameNotificationProvider>
        <GameDisplay game={data.game} refetch={refetch} />
        <GameEventProcessor game={data.game} refetch={refetch} />
      </GameNotificationProvider>
    </>
  );
};

export const ScoreDisplay = ({ users }) => {
  const [sortedUsers, setSortedUsers] = useState([]);
  useEffect(() => {
    if (!users) {
      setSortedUsers([]);
      return;
    }
    let newSortedUsers = [...users];
    newSortedUsers.sort((a, b) => {
      return b.score !== a.score
        ? b.score - a.score
        : a.name.localeCompare(b.name);
    });
    setSortedUsers(newSortedUsers);
  }, [users]);
  return (
    <>
      <h3>Scores</h3>
      {sortedUsers &&
        sortedUsers.map((user) => (
          <p key={user.uuid}>
            <i className="fas fa-star" /> {user.score} {user.name}
          </p>
        ))}
    </>
  );
};

export const StartGameSection = ({ game }) => {
  const apolloClient = useApolloClient();
  return (
    <div className="game-manager__start-section">
      <h3>Game ready</h3>
      <p>Click below to start.</p>
      <button
        className="game-manager__start-button"
        onClick={async () => {
          await StartGame({ apolloClient, gameUuid: game.uuid });
        }}
      >
        Start game
      </button>
    </div>
  );
};

export const EndGameSection = ({ game }) => {
  const backToLobby =
    game.lobby && game.lobby.joinCode ? (
      <Link
        to={`/lobby/${game.lobby.joinCode}`}
        style={{ color: "white", textDecoration: "none" }}
      >
        <i className="fas fa-arrow-circle-left" /> Return to lobby
      </Link>
    ) : null;
  return (
    <div className="game-manager__finished-section">
      <ScoreDisplay users={game.users} />
      {backToLobby}
    </div>
  );
};

const GameOngoingDisplay = ({ game }) => {
  const apolloClient = useApolloClient();
  const [answerInputValue, setAnswerInputValue] = useState("");

  useEffect(() => {
    setAnswerInputValue("");
  }, [game.currentTrackIndex]);

  return (
    <>
      <ScoreDisplay users={game.users} />
      <div className="game-manager__section">
        <TrackPreview
          previewUrl={game.tracks[game.currentTrackIndex].previewUrl}
        />
        <p className="game-manager__progress-text">
          Track n°{game.currentTrackIndex + 1}{" "}
          <CountdownCircle nextTrackAt={game.nextTrackAt} />
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await proposeAnswer({
                apolloClient,
                answerText: answerInputValue,
                gameUuid: game.uuid,
                trackIndex: game.currentTrackIndex,
              });
            } catch (e) {
              if (
                e.message === "WRONG_TRACK_INDEX" ||
                e.message === "ALREADY_ANSWERED"
              ) {
                window.location.reload();
              } else {
                throw e;
              }
            }
            setAnswerInputValue("");
          }}
        >
          <input
            type="text"
            placeholder="Make a guess"
            value={answerInputValue}
            onChange={(e) => {
              setAnswerInputValue(e.target.value);
            }}
            className="game-manager__input"
            autoComplete="off"
            style={{ outline: "none" }}
          />
        </form>
      </div>
    </>
  );
};

const GameDisplay = ({ game, refetch }) => {
  const apolloClient = useApolloClient();
  const [gameFlowSection, setGameFlowSection] = useState(null);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setForceRefreshToken(Date.now());
  //   }, 1000);
  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    if (!game) return;
    const gameEnded = game.endAt && new Date(+game.endAt) < Date.now();
    if (
      !gameEnded &&
      game.nextTrackAt &&
      new Date(+game.nextTrackAt) < Date.now()
    ) {
      refetch();
    }
    if (game.currentTrackIndex < 0) {
      setGameFlowSection(<StartGameSection game={game} />);
    } else if (game.currentTrackIndex >= 0 && game.nextTrackAt && !gameEnded) {
      setGameFlowSection(<GameOngoingDisplay game={game} />);
    } else {
      setGameFlowSection(<EndGameSection game={game} />);
    }
  }, [game, apolloClient, refetch]);
  if (!game) return null;

  return <div className="game__section">{gameFlowSection}</div>;
};

const CountdownCircle = ({ nextTrackAt }) => {
  const [refreshKey, setRefreshKey] = useState("");
  const [originalRemainingTime, setOriginalRemainingTime] = useState(null);

  useEffect(() => {
    if (nextTrackAt)
      setOriginalRemainingTime(new Date(+nextTrackAt) - new Date());
  }, [nextTrackAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(uuid());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const diffCoeff = Math.max(
    1 - (new Date(+nextTrackAt) - new Date()) / originalRemainingTime,
    0
  );
  return (
    <Circle
      refresh={refreshKey}
      className="game-manager__progress-circle"
      percent={diffCoeff * 100}
      strokeWidth={10}
      strokeColor={`rgb(${255 - diffCoeff * 10},${
        255 - Math.pow(diffCoeff, 2) * 200
      },${255 - Math.pow(diffCoeff, 2) * 200})`}
    />
  );
};

const AutoHide = ({ children, delayMs }) => {
  const [shouldDisplay, setShouldDisplay] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setShouldDisplay(false);
    }, delayMs);
  }, [setShouldDisplay, delayMs]);
  if (!shouldDisplay) return null;
  return children;
};

const proposeAnswer = async ({
  apolloClient,
  gameUuid,
  trackIndex,
  answerText,
}) => {
  if (answerText.trim().length <= 0) return;
  try {
    const resp = await apolloClient.mutate({
      mutation: gql`
        mutation ProposeAnswer(
          $gameUuid: ID
          $trackIndex: Int
          $answerText: String
        ) {
          proposeAnswer(
            gameUuid: $gameUuid
            trackIndex: $trackIndex
            answerText: $answerText
          )
        }
      `,
      variables: {
        gameUuid,
        trackIndex,
        answerText,
      },
    });
    return resp;
  } catch (e) {
    throw e;
  }
};

const GameEventProcessor = ({ game, refetch }) => {
  const [
    gameNotification,
    gameNotificationDispatch,
  ] = useGameNotificationContext();
  const { data, loading } = useSubscription(
    gql`
      subscription OnGameEvent($gameUuid: ID) {
        gameEvent(gameUuid: $gameUuid) {
          kind
          userName
          answeredBy
          answerText
        }
      }
    `,
    {
      variables: {
        gameUuid: game.uuid,
      },
    }
  );
  useEffect(() => {
    if (!data || !data.gameEvent || !data.gameEvent) return;
    console.log({
      event: "gameEventProcessor.newEvent",
      kind: data.gameEvent ? data.gameEvent.kind : null,
    });
    let notificationConfig = {
      type: "default",
      message: "",
    };
    const kind = data.gameEvent.kind ? data.gameEvent.kind.toUpperCase() : null;
    switch (kind) {
      case "ANSWER_ACCEPTED":
        notificationConfig.type = "success";
        notificationConfig.message = (
          <span>
            <span className="game-notification__content--username">
              {data.gameEvent.userName || "Someone"}
            </span>
            <br />
            guessed {game.tracks[game.currentTrackIndex].name} by{" "}
            {game.tracks[game.currentTrackIndex].artists
              .map((artist) => artist.name)
              .join(" & ")}{" "}
            !
          </span>
        );
        break;
      case "ANSWER_REJECTED":
        notificationConfig.type = "error";
        notificationConfig.message = (
          <span>
            <span className="game-notification__content--username">
              {data.gameEvent.answerText}
            </span>
            <br />
            is wrong !{" "}
            {data.gameEvent.userName ? `(${data.gameEvent.userName})` : null}
          </span>
        );
        break;
      case "GAME_FINISHED":
        notificationConfig.type = "default";
        notificationConfig.message = (
          <span className="game-notification__content--fullheight">
            Game finished !
          </span>
        );
        break;
      case "NEXT_TRACK":
        setTimeout(() => {
          refetch();
        }, new Date(+game.nextTrackAt) - new Date() + 200);
        console.log({ msg: "next track" });
        if (game.currentTrackIndex === -1) {
          notificationConfig = null;
          break;
        }
        if (data.gameEvent.answeredBy) {
          notificationConfig.type = "success";
          notificationConfig.message = (
            <span>
              <span className="game-notification__content--username">
                {game.tracks[game.currentTrackIndex].name} by{" "}
                {game.tracks[game.currentTrackIndex].artists
                  .map((artist) => artist.name)
                  .join(" & ")}{" "}
              </span>
              <br />
              guessed by {data.gameEvent.answeredBy || "Someone"}
            </span>
          );
        } else {
          notificationConfig.type = "default";
          notificationConfig.message = (
            <span>
              <span className="game-notification__content--username">
                {game.tracks[game.currentTrackIndex].name} by{" "}
                {game.tracks[game.currentTrackIndex].artists
                  .map((artist) => artist.name)
                  .join(" & ")}
              </span>
              <br />
              No one found the answer !
            </span>
          );
        }
        break;
      default:
        notificationConfig.type = "success";
        notificationConfig.message = data.gameEvent.kind;
        break;
    }
    refetch();
    if (notificationConfig) {
      gameNotificationDispatch({
        action: "SHOW_NOTIFICATION",
        notification: notificationConfig,
      });
      setTimeout(() => {
        gameNotificationDispatch({
          action: "HIDE_NOTIFICATION",
        });
      }, 6000);
    }
  }, [data, refetch, gameNotificationDispatch]);
  const notificationRef = useRef(null);

  if (loading || !data || !data.gameEvent || !data.gameEvent.kind) return null;
  return (
    <>
      <div className={`game-notification__display`}>
        {gameNotification.notifications &&
          gameNotification.notifications.map((notification) => (
            <div
              className={`game-notification__item game-notification__item--${notification.type}`}
              ref={notificationRef}
              key={notification.uid}
            >
              {notification.message}
            </div>
          ))}
      </div>
      {/* <p>Last event: {data.gameEvent.kind}</p> */}
    </>
  );
};

function TrackPreview({ previewUrl, autoPlay = true }) {
  return (
    <>
      <ReactAudioPlayer src={previewUrl} autoPlay={autoPlay} />
    </>
  );
}

const StartGame = async ({ apolloClient, gameUuid }) => {
  return await apolloClient.mutate({
    mutation: gql`
      mutation StartGame($gameUuid: ID) {
        startGame(gameUuid: $gameUuid)
      }
    `,
    variables: {
      gameUuid,
    },
  });
};
