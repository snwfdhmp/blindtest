import React, { useState, useEffect } from "react";
import useUserContext from "../../UserContext";
import { gql, useApolloClient } from "@apollo/client";
import { Link } from "react-router-dom";
import { LinkWithCopy } from "../../atoms/LinkWithCopy";
import { CreateLobby } from "../LobbyManager";

export default function LobbyHeader() {
  const lobbyJoinCode = localStorage.getItem("currentLobbyJoinCode");
  const [lobbyData, setLobbyData] = useState(null);
  const apolloClient = useApolloClient();
  const [user, _] = useUserContext();
  const [buttonContent, setButtonContent] = useState("Create lobby");

  useEffect(() => {
    if (!user || !user.data || !user.data.userUuid) return;
    if (!lobbyJoinCode || lobbyJoinCode === "" || lobbyJoinCode === "null")
      return null;
    apolloClient
      .query({
        query: gql`
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
        variables: {
          joinCode: lobbyJoinCode,
        },
        fetchPolicy: "no-cache",
      })
      .then((data) => {
        setLobbyData(data.data.lobby);
      })
      .catch((error) => {
        console.log({ error });
      });
  }, [apolloClient, lobbyJoinCode, user]);

  if (!user || !user.data || !user.data.userUuid) return null;

  if (
    !lobbyJoinCode ||
    lobbyJoinCode === "" ||
    lobbyJoinCode === "null" ||
    !lobbyData
  )
    return (
      <button
        onClick={() => {
          setButtonContent(<CreateLobby />);
        }}
      >
        {buttonContent}
      </button>
    );

  return (
    <>
      {lobbyData && (
        <span className="user-header__name">
          <p>
            <Link to="/lobby" style={{ color: "white" }}>
              In lobby
            </Link>{" "}
            <i className="fas fa-user-friends" />{" "}
            {!lobbyData.users ? 0 : lobbyData.users.length}{" "}
            <LinkWithCopy
              text={lobbyData.joinCode}
              localUrl={`/lobby/${lobbyData.joinCode}`}
              bigSize="1.4rem"
              smallSize="0.9rem"
            />
          </p>
          {lobbyData.users.length > 1 && (
            <div>
              Players in lobby: <br />
              {lobbyData.users &&
                lobbyData.users.map((user) => (
                  <span key={user.uuid}>
                    <span>- {user.name}</span>
                    <br />
                  </span>
                ))}
            </div>
          )}
        </span>
      )}
    </>
  );
}
