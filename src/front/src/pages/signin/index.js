import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useApolloClient } from "@apollo/client";
import jwtDecode from "jwt-decode";

import { getValueFromLocalStorage, saveTokens } from "../../constants/utils";
import userContext, {
  REDUCER_ACTIONS as USER_REDUCER_ACTIONS,
} from "../../components/UserContext";
import { SIGNIN_QUERY } from "./graphql";

export default function Page() {
  return (
    <div>
      <SigninForm />
    </div>
  );
}

export function SigninForm({ location }) {
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const apolloClient = useApolloClient();
  const [user, userDispatch] = userContext();

  const onSubmit = async (formData) => {
    setError && setError(null);
    try {
      const { data } = await apolloClient.query({
        query: SIGNIN_QUERY,
        variables: {
          email: formData.email,
          password: formData.password,
          refreshToken:
            formData.refreshToken || getValueFromLocalStorage("refreshToken"),
        },
        fetchPolicy: "no-cache",
      });
      if (data.authenticate.error) {
        setError && setError(data.authenticate.error);
        return;
      }
      const refreshToken = data.authenticate.refreshToken;
      const accessToken = data.authenticate.accessToken;
      const decodedToken = jwtDecode(accessToken);

      userDispatch({
        action: USER_REDUCER_ACTIONS.SIGN_IN,
        user: decodedToken && decodedToken.identity,
      });
      saveTokens({ accessToken, refreshToken });
      setDone && setDone(true);
    } catch (e) {
      setError && setError(e);
      console.log("error:", e);
    }
  };

  return (
    <form onSubmit={() => handleSubmit((data) => onSubmit(data))}>
      <input
        name="email"
        ref={register}
        placeholder="Email address"
        type="text"
      />
      <input
        name="password"
        ref={register}
        placeholder="Password"
        type="password"
      />
      <input type="submit" value="Sign in" />
    </form>
  );
}
