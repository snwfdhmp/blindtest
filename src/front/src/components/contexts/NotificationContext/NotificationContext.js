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
      payload.uid = uuid();
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
        newState.notifications.splice(0, 1);
      }
      return newState;
    }

    default: {
      return { ...state };
    }
  }
};

const NotificationContext = createContext();

const useNotificationContext = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const defaultNotification = null;

  return (
    <NotificationContext.Provider
      value={useReducer(reducer, { data: defaultNotification })}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export default useNotificationContext;
