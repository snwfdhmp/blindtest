import React from "react";

import "./style.scss";

export default function Component({ title, pictureUrl }) {
  return (
    <div className="result-item">
      <span className="result-item__media">
        <img src={pictureUrl} alt={title} />
      </span>
      <div className="result-item__title">{title}</div>
    </div>
  );
}
