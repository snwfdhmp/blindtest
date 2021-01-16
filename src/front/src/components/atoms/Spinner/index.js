import classNames from "classnames";

import "./style.scss";

export function Spinner({ fullScreen = false, text, style }) {
  let imgStyle = {
    width: "2rem",
    ...style,
  };
  const className = classNames({
    spinner__display: true,
    "spinner__display--fullscreen": fullScreen,
  });

  return (
    <div className={className}>
      {!text ? null : <span>{text}</span>}
      <img
        src={"https://www.jettools.com/images/animated_spinner.gif"}
        alt=""
        style={imgStyle}
      />
    </div>
  );
}
