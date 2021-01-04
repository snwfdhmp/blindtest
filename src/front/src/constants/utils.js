export function getValueFromLocalStorage(key) {
  const auth = JSON.parse(localStorage.getItem("auth"));
  if (!auth || !auth.currentAuth) return null;
  const currentAuth = auth[auth.currentAuth];
  return currentAuth[key];
}

export function setValueFromLocalStorage(key, value) {
  const auth = JSON.parse(localStorage.getItem("auth"));
  if (!auth || !auth.currentAuth) return null;
  const currentUser = auth[auth.currentAuth];
  currentUser[key] = value;
  auth[auth.currentAuth] = currentUser;
  localStorage.setItem("auth", JSON.stringify(auth));
}

export function setCurrentUser(newUser) {
  const auth = JSON.parse(localStorage.getItem("auth"));
  auth.currentAuth = newUser;
  localStorage.setItem("auth", JSON.stringify(auth));
}

export function unsetTokens(forceLogout) {
  let auth = JSON.parse(localStorage.getItem("auth"));
  if (auth && auth[auth.currentAuth]) {
    if (forceLogout) auth[auth.currentAuth].refreshToken = "";
    auth[auth.currentAuth].accessToken = "";
    auth[auth.currentAuth].authorizationKind = "";
  }
  if (auth && auth.currentAuth) {
    auth.currentAuth = "";
  }
  localStorage.setItem("auth", JSON.stringify(auth));
}

export const saveTokens = ({ accessToken, refreshToken, role }) => {
  let auth = JSON.parse(localStorage.getItem("auth")) || null;

  if (!auth) {
    const newAuth = {};
    newAuth.currentAuth = role.main;
    newAuth[role.main] = {};
    newAuth[role.main].accessToken = accessToken;
    newAuth[role.main].refreshToken = refreshToken;
    newAuth[role.main].authorizationKind = role.authorizationKind;
    auth = newAuth;
  } else {
    auth.currentAuth = role.main;
    if (!auth[role.main]) auth[role.main] = {};
    auth[role.main].accessToken = accessToken;
    auth[role.main].refreshToken = refreshToken;
    auth[role.main].authorizationKind = role.authorizationKind;
  }
  localStorage.setItem("auth", JSON.stringify(auth));
};
