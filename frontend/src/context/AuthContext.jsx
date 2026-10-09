// Central auth store. Persists token + user in localStorage as `sipadin_user`
// so existing modules (AppLayout, klasifikasi API) that already read it keep working.
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "sipadin_user";

const AuthContext = createContext(null);

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStored());
  const [loading, setLoading] = useState(true);

  const persist = useCallback((data) => {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(data);
  }, []);

  // Rehydrate against backend on mount if token present
  useEffect(() => {
    const stored = readStored();
    if (!stored?.token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored.token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauth");
        const me = await res.json();
        persist({ ...stored, ...me });
      })
      .catch(() => persist(null))
      .finally(() => setLoading(false));
  }, [persist]);

  const login = useCallback(async (nip, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nip, password }),
    });
    if (!res.ok) {
      let msg = "Login gagal";
      try {
        const d = await res.json();
        msg = d.detail || msg;
      } catch (_e) { /* ignore */ }
      throw new Error(msg);
    }
    const data = await res.json();
    persist({ token: data.token, ...data.user });
    return data.user;
  }, [persist]);

  const logout = useCallback(() => persist(null), [persist]);

  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const getToken = () => readStored()?.token || "";

export const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
