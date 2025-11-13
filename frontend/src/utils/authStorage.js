const TOKEN_KEY = "cv_auth_token";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function persistToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  persistToken(null);
}

export { TOKEN_KEY };
