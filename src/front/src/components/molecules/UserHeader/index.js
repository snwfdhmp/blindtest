import React, { useState, useEffect } from "react";
import useUserContext from "../../UserContext";
import { Redirect } from "react-router-dom";
import { gql, useApolloClient } from "@apollo/client";
import { Link } from "react-router-dom";
import { getValueFromLocalStorage } from "../../../constants/utils";

import "./style.scss";

export default function UserHeader() {
  const [user, userDispatch] = useUserContext();
  const [userData, setUserData] = useState(null);
  const apolloClient = useApolloClient();

  useEffect(() => {
    if (!getValueFromLocalStorage("accessToken"))
      return <Redirect to="/signout" />;
    apolloClient
      .query({
        query: gql`
          query user {
            user {
              uuid
              name
            }
          }
        `,
      })
      .then((data) => {
        setUserData(data.data.user);
      })
      .catch((error) => {
        console.log({ error });
      });
  }, [apolloClient]);

  if (!user) return <Redirect to="/signout" />;

  return (
    <div className="user-header__section">
      <span className="user-header__name" style={{ fontSize: "1.5rem" }}>
        {userData && userData.name}{" "}
      </span>
      <p>
        <Link to={"/connect/spotify"} style={{ textDecoration: "none" }}>
          <button className="user-header__button">
            <i className="fab fa-spotify" /> {userData ? "Sync" : "Log in with"}{" "}
            Spotify account
          </button>
        </Link>
      </p>
    </div>
  );
}
