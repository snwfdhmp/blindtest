import React from "react";

import "./style.scss";

export default function NavItem({ title }) {
  return (
    <div className="nav-item">
      <span className="nav-item__title">{title}</span>
    </div>
  );
}
