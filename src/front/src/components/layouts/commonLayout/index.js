import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAxios from "axios-hooks";
import LobbyManager from "../../molecules/LobbyManager";
import useNotificationContext from "../../contexts/NotificationContext";

import "./style.scss";

import NavItem from "../../atoms/NavItem";
import UserHeader from "../../molecules/UserHeader";
import LobbyHeader from "../../molecules/LobbyHeader";
// import SearchView from "../SearchView";

const STATES = {
  CONTENT: 1,
  SEARCH: 2,
};

export default function CommonLayout({ children }) {
  const [mode, setMode] = useState(STATES.CONTENT);
  const [display, setDisplay] = useState(children);
  const [notifications, notificationDispatch] = useNotificationContext();
  const [notificationsToDisplay, setNotificationsToDisplay] = useState([]);

  useEffect(() => {
    switch (mode) {
      case STATES.CONTENT:
        setDisplay(children);
        break;
      // case STATES.SEARCH:
      //   setDisplay(<SearchView query={"test"} />);
      //   break;
      default:
        setDisplay(<h1>Error: Unknown mode</h1>);
        break;
    }
  }, [children, mode]);

  useEffect(() => {
    if (notifications.notifications) {
      setTimeout(() => {
        notificationDispatch({
          action: "HIDE_NOTIFICATION",
        });
      }, 8000);
    }
  }, [notifications.notifications, notificationDispatch]);

  return (
    <div>
      <div className="common-layout__sidebar">
        <h2
          style={{
            fontFamily: "monospace",
            textAlign: "center",
            marginLeft: "-1rem",
          }}
        >
          BLINDTEST
        </h2>
        <UserHeader />
        {/* <LobbyManager displayShort={true} /> */}
        <LobbyHeader />
        <Nav />
      </div>
      <>
        {notificationsToDisplay &&
          notificationsToDisplay.map((notificationToDisplay) => {
            notificationToDisplay.data && (
              <div className={`game-notification__display`}>
                <div
                  className={`game-notification__item game-notification__item--${notificationToDisplay.data.type}`}
                >
                  {notificationToDisplay.data.message}
                </div>
              </div>
            );
          })}
      </>
      {/* <div className="common-layout__topbar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Rechercher"
          // onFocus={() => setMode(STATES.SEARCH)}
        ></input>{" "}
      </div> */}
      <div className="common-layout__content">{display}</div>
    </div>
  );
}

export function Nav() {
  const content = [
    // {
    //   title: "Les films",
    //   items: [
    //     { title: "Classement des films" },
    //     { title: "Classement des séries" },
    //     { title: "Tendances mondiales" },
    //     { title: "Tendances locales" },
    //     { title: "Playlists" },
    //   ],
    // },
    // {
    //   title: "",
    // },
  ];

  return (
    <div>
      {content.map((section) => (
        <div className="nav-section">
          <div className="nav-item">
            <span className="nav-item__section-title">{section.name}</span>
          </div>
        </div>
      ))}
      {/* <div className="nav-section">
        <div className="nav-item">
          <span className="nav-item__section-title">Mes playlists</span>
          <PlaylistList />
        </div>
      </div> */}
    </div>
  );
}

function PlaylistList() {
  const [{ loading, data, error }, refetch] = useAxios({
    url: "https://api.spotify.com/v1/me/playlists?limit=50",
    headers: {
      Authorization:
        "Bearer BQClLEibdwnUaoa3PIZ7EOZQI-4WTL6Gvnc8DR7JiiO3VX2AMZIGu451Z036PPSdz6nZ5FEoMJlqJcRJ-enzhJnUbL_PXSHOjSPpayWLrHFdlaX3eNPi4rJG3Uo2GlBMZzyrBvd3S04a",
    },
  });

  if (loading) return null;
  if (error) return <p>Error: {JSON.stringify(error)}</p>;
  if (!data) return <p>Uncatched error (but no data)</p>;

  return (
    <>
      {data.items.map((item) => (
        <NavItem title={item.name} />
      ))}
    </>
  );
}
