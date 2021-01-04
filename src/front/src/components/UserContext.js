import React, { useReducer, createContext, useContext } from "react";
import jwtDecode from "jwt-decode";
import { getValueFromLocalStorage } from "../constants/utils";

export const REDUCER_ACTIONS = {
  SIGN_IN: "SIGN_IN",
  SIGN_OUT: "SIGN_OUT",
};

const reducer = (state, payload) => {
  switch (payload.action) {
    case REDUCER_ACTIONS.SIGN_IN: {
      return { data: payload.user };
    }

    case REDUCER_ACTIONS.SIGN_OUT: {
      return { data: null };
    }

    default: {
      return { ...state };
    }
  }
};

const UserContext = createContext();

const useUserContext = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const token = getValueFromLocalStorage("accessToken");
  const decodedToken = token && jwtDecode(token);
  return (
    <UserContext.Provider
      value={useReducer(reducer, {
        data: decodedToken && decodedToken.identity,
      })}
    >
      {children}
    </UserContext.Provider>
  );
};

export default useUserContext;
