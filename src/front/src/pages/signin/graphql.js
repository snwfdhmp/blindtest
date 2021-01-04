import { gql } from "@apollo/client";

export const SIGNIN_QUERY = gql`
  query authenticate($email: String, $password: String, $refreshToken: String) {
    authenticate(
      email: $email
      password: $password
      refreshToken: $refreshToken
    ) {
      accessToken
      refreshToken
      error
    }
  }
`;
