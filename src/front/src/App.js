import React, { useState, useEffect } from "react";
import {
  Switch,
  BrowserRouter as Router,
  Route,
  Redirect,
  Link,
} from "react-router-dom";
import "./App.css";
import RootPage from "./pages/root";
import GamePage from "./pages/game";
import LobbyPage from "./components/molecules/LobbyManager";
import GameManagerPage from "./components/molecules/GameManager";
import PlaylistsPage from "./pages/playlists";
import TopTracksPage from "./pages/top-tracks";
import SigninPage from "./pages/signin";
import SignupPage from "./pages/signup";
import CommonLayout from "./components/layouts/commonLayout";
import { NotificationProvider } from "./components/contexts/NotificationContext/NotificationContext";
import useUserContext, {
  UserProvider,
  REDUCER_ACTIONS as USER_REDUCER_ACTIONS,
} from "./components/UserContext";
import {
  getValueFromLocalStorage,
  unsetTokens,
  saveTokens,
} from "./constants/utils";

import jwtDecode from "jwt-decode";

import {
  ApolloClient,
  ApolloProvider,
  from,
  InMemoryCache,
  split,
} from "@apollo/client";
import { createHttpLink } from "apollo-link-http";
import { getMainDefinition } from "@apollo/client/utilities";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import qs from "qs";
import { WebSocketLink } from "@apollo/client/link/ws";
import "./style.scss";
import Axios from "axios";

let serverAddr = process.env.REACT_APP_SERVER_ADDR || "localhost:4000";

const apiBaseUrl = `http://${serverAddr}`;

const wsLink = new WebSocketLink({
  uri: `ws://${serverAddr}/subscriptions`,
  options: {
    reconnect: true,
  },
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      if (extensions && extensions.code == "UNAUTHENTICATED")
        window.location = "/signout?tryRefresh=true";
      console.log({
        level: "error",
        errorType: "graphQLError",
        message,
        locations,
        path,
      });
    });
  }
});
const httpLink = createHttpLink({ uri: apiBaseUrl + "/graphql" });
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

const authLink = setContext((_, { headers }) => {
  const token = getValueFromLocalStorage("accessToken");

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
      "Authorization-Kind": getValueFromLocalStorage("authorizationKind"),
    },
  };
});

const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, splitLink]),
  cache: new InMemoryCache({
    typePolicies: {
      User: {
        keyFields: ["uuid"],
      },
      GameUser: {
        keyFields: ["uuid"],
      },
      LobbyUser: {
        keyFields: ["uuid"],
      },
      Game: {
        keyFields: ["uuid"],
      },
      Lobby: {
        keyFields: ["uuid"],
      },
    },
  }),
});

function App() {
  return (
    <NotificationProvider>
      <ApolloProvider client={apolloClient}>
        <UserProvider>
          <Router>
            <Switch>
              <Route exact path="/" component={RootRedirector} />
              <Route exact path="/signin" component={SigninPage} />
              <Route exact path="/connect/spotify" component={ConnectSpotify} />
              <Route
                exact
                path="/connect/spotify/callback"
                component={ConnectSpotifyCallback}
              />
              <Route exact path="/signup" component={SignupPage} />
              <CommonLayout>
                <Route
                  exact
                  path="/game/:joinCode"
                  component={GameManagerPage}
                />
                <Route exact path="/lobby/:joinCode" component={LobbyPage} />
                <Route exact path="/lobby" component={LobbyPage} />
                <Route exact path="/playlists" component={PlaylistsPage} />
                <Route exact path="/top-tracks" component={TopTracksPage} />
                <Route exact path="/signout" component={Signout} />
              </CommonLayout>
            </Switch>
          </Router>
        </UserProvider>
      </ApolloProvider>
    </NotificationProvider>
  );
}

export const RootRedirector = () => {
  const [user, _] = useUserContext();

  if (user && user.data) return <Redirect to="/lobby" />;
  return <Redirect to="/signup" />;
};

export function Signout({
  userDispatch,
  client,
  forceLogout = false,
  location,
}) {
  if (client) client.clearStore();
  if (userDispatch) userDispatch({ action: USER_REDUCER_ACTIONS.SIGN_OUT });

  unsetTokens(forceLogout);

  localStorage.setItem("client", "");
  localStorage.setItem("userUpdatedAt", "");

  if (forceLogout) return <Redirect to="/signin" />;
  return <Redirect to="/connect/spotify" />;
}

export default App;

export function ConnectSpotify({ location }) {
  const [rendered, setRendered] = useState(<p>Waiting...</p>);

  useEffect(() => {
    const requestUrl = apiBaseUrl + "/spotify-login";
    Axios.get(requestUrl, {
      headers: {
        "redirect-uri": window.location.href + "/callback",
      },
    }).then((data) => {
      if (!data.data || !data.data.redirect) {
        setRendered(<p>Error. data = {JSON.stringify(data)}</p>);
        return;
      }
      window.location.href = data.data.redirect;
    });
  }, []);
  return <div>{rendered}</div>;
}

export function ConnectSpotifyCallback({ location }) {
  const [user, userDispatch] = useUserContext();
  const [rendered, setRendered] = useState(
    <p>
      Waiting... <Link to={location.pathname + location.search}>retry</Link>{" "}
      <Link to={"/connect/spotify"}>to start</Link>
    </p>
  );
  const params = qs.parse(location.search.slice(1));
  const [didAuth, setDidAuth] = useState(false);

  useEffect(() => {
    if (didAuth) return;
    setDidAuth(true);
    if (!params.code) {
      setRendered(<p>Error: Missing code !</p>);
      return;
    }
    const requestUrl = apiBaseUrl + "/spotify-login/callback";
    Axios.post(
      requestUrl,
      {
        code: params.code,
      },
      {
        headers: {
          "redirect-uri": window.location.href.replace(location.search, ""),
          "content-type": "application/json",
        },
      }
    ).then((data) => {
      if (!data.data || !data.data.identity || !data.data.identity.uuid) {
        setRendered(
          <p>
            <Link to={location.pathname + location.search}>retry</Link>{" "}
            <Link to={"/connect/spotify"}>to start</Link> Error. data ={" "}
            {JSON.stringify(data)}
          </p>
        );
        return;
      }
      setRendered(
        <p>
          <Link to={location.pathname + location.search}>retry</Link>{" "}
          <Link to={"/connect/spotify"}>to start</Link>
          {JSON.stringify(data.data)}
        </p>
      );

      const refreshToken = data.data.refreshToken;
      const accessToken = data.data.accessToken;
      const decodedToken = jwtDecode(accessToken);

      userDispatch({
        action: USER_REDUCER_ACTIONS.SIGN_IN,
        user: decodedToken && decodedToken.identity,
      });
      saveTokens({
        accessToken,
        refreshToken,
        role: {
          main: "user",
        },
      });
      setTimeout(() => {
        window.location.href = window.location.href
          .replace(location.search, "")
          .replace(location.pathname, "/lobby");
      }, 200);
    });
  }, [params, location.search, didAuth, location.pathname, userDispatch]);
  return <div>{rendered}</div>;
}
