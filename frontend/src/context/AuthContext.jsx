import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, logoutRequest, fetchCurrentUser } from "../api.js";
import { getStoredToken, persistToken, clearToken } from "../utils/authStorage.js";

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  isAuthed: false,
  login: async () => {},
  logout: async () => {}
});

function useUnauthorizedListener(onUnauthorised) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handler() {
      onUnauthorised?.();
    }
    window.addEventListener("cv:unauthorised", handler);
    return () => window.removeEventListener("cv:unauthorised", handler);
  }, [onUnauthorised]);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const resetAuth = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useUnauthorizedListener(resetAuth);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCurrentUser()
      .then((res) => {
        if (cancelled) return;
        setUser(res.user || null);
      })
      .catch(() => {
        if (cancelled) return;
        resetAuth();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, resetAuth]);

  const login = useCallback(async ({ email, password }) => {
    const res = await loginRequest({ email, password });
    persistToken(res.token);
    setToken(res.token);
    setUser(res.user || null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // ignore network errors during logout
    }
    resetAuth();
  }, [resetAuth]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthed: Boolean(user),
      login,
      logout
    }),
    [user, token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
