import React, { useState } from "react";
import { Link } from "react-router-dom";

import "./style.scss";

export default function Page() {
  return (
    <div className="signup__section">
      <div className="signup__content">
        <h1 style={{ fontFamily: "monospace", marginBottom: "2rem" }}>
          BLINDTEST
        </h1>
        <Link to={"/connect/spotify"} style={{ textDecoration: "none" }}>
          <button className="user-header__button">
            <i className="fab fa-spotify" /> Log in with Spotify account
          </button>
        </Link>
      </div>
    </div>
  );
}
