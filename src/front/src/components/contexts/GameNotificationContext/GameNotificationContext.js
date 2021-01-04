import React, { useReducer, createContext, useContext } from "react";
import { v4 as uuid } from "uuid";

export const REDUCER_ACTIONS = {
  SHOW_NOTIFICATION: "SHOW_NOTIFICATION",
  HIDE_NOTIFICATION: "HIDE_NOTIFICATION",
};

const reducer = (state, payload) => {
  switch (payload.action) {
    case REDUCER_ACTIONS.SHOW_NOTIFICATION: {
      if (!state.notifications) state.notifications = [];
      payload.notification.uid = uuid();
      state.notifications.push(payload.notification);
      return state;
    }

    case REDUCER_ACTIONS.HIDE_NOTIFICATION: {
      let newState = { ...state };
      if (payload.uid && newState.notifications) {
        for (let i = 0; i < newState.notifications.length; i++) {
          if (newState.notifications[i].uid === payload.uid) {
            newState.notifications.splice(i, 1);
            i--;
          }
        }
      } else {
        newState.notifications.shift();
      }
      return newState;
    }

    default: {
      return { ...state };
    }
  }
};

const GameNotificationContext = createContext();

const useGameNotificationContext = () => useContext(GameNotificationContext);

export const GameNotificationProvider = ({ children }) => {
  const defaultNotification = null;

  return (
    <GameNotificationContext.Provider
      value={useReducer(reducer, { data: defaultNotification })}
    >
      {children}
    </GameNotificationContext.Provider>
  );
};

export default useGameNotificationContext;
