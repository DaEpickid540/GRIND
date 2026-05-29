import { createContext, useContext, useEffect, useState } from "react";
import { onAuth, getOrCreateUser, getUserProfile } from "../lib/firebase";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => onAuth(async (fu) => {
    if (fu) { const p = await getOrCreateUser(fu); setProfile(p); setUser(fu); }
    else     { setUser(null); setProfile(null); }
  }), []);

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  return <AuthCtx.Provider value={{ user, profile, refreshProfile }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
