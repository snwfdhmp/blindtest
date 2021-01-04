import React from "react";
import { Link, useLocation } from "react-router-dom";

export const LinkWithCopy = ({
  localUrl,
  text,
  bigSize = "1.5rem",
  smallSize = "1rem",
}) => {
  const location = useLocation();
  const absoluteLink = window.location.href.replace(
    location.pathname + location.search,
    localUrl
  );

  return (
    <Link
      to={localUrl}
      style={{
        color: "white",
        textDecoration: "none",
        marginRight: "0.3rem",
      }}
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(absoluteLink);
      }}
    >
      <span
        className="join-code"
        style={{ fontSize: bigSize, textDecoration: "underline" }}
      >
        {text}
      </span>
      <span style={{ textDecoration: "none" }}>
        {" "}
        <i className="fas fa-clipboard" style={{ fontSize: smallSize }} />
      </span>
    </Link>
  );
};
