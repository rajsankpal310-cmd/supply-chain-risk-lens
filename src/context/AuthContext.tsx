import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "@/services/authService";
import type { Credentials, RegisterInput, User, UserRole } from "@/types";

export type Permission =
  | "data:upload"
  | "data:manage"
  | "simulation:run"
  | "recommendations:view"
  | "reports:generate"
  | "settings:manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SME_ADMIN: ["data:upload", "data:manage", "simulation:run", "recommendations:view", "reports:generate", "settings:manage"],
  ANALYST: ["simulation:run", "recommendations:view", "reports:generate"],
  VIEWER: ["recommendations:view"],
};

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: Credentials) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => void;
  setRole: (role: UserRole) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(authService.getCurrentUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    const next = await authService.login(credentials);
    setUser(next);
    return next;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await authService.register(input);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback((patch: Partial<User>) => {
    setUser(authService.updateProfile(patch));
  }, []);

  const setRole = useCallback((role: UserRole) => {
    setUser(authService.updateProfile({ role }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      updateProfile,
      setRole,
      can: (permission) => (user ? ROLE_PERMISSIONS[user.role].includes(permission) : false),
    }),
    [user, isLoading, login, register, logout, updateProfile, setRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
