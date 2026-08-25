import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { UserOut, RegisterPayload, LoginPayload } from "../types";
import { register as apiRegister, login as apiLogin, getMe } from "../api/auth";

// ── Context shape ──────────────────────────────────────────────────────────

interface AuthContextValue {
  user: UserOut | null;
  token: string | null;
  isLoading: boolean;           // true while bootstrapping from localStorage
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Validate stored token by hitting /me
    setToken(storedToken);
    getMe()
      .then((userData) => setUser(userData))
      .catch(() => {
        // Token is expired or invalid — clear storage
        localStorage.removeItem("access_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const persistSession = useCallback((accessToken: string, userData: UserOut) => {
    localStorage.setItem("access_token", accessToken);
    setToken(accessToken);
    setUser(userData);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await apiLogin(payload);
    persistSession(data.access_token, data.user);
  }, [persistSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await apiRegister(payload);
    persistSession(data.access_token, data.user);
  }, [persistSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
  }, []);

  // ── Value ─────────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
