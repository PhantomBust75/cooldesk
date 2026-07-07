"use client";

import { apiClient, ApiError, SESSION_STORAGE_KEY } from "@/lib/api/client";
import type { LoginRequest, LoginResponse, SessionState, UserRole } from "@/types/auth";
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  session: SessionState | null;
  login: (credentials: LoginRequest) => Promise<UserRole>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapLoginResponseToSession(payload: LoginResponse): SessionState {
  const accessToken = payload.accessToken;
  const userId = payload.user?.id ?? payload.user_id;
  const organizationId = payload.user?.organization_id ?? payload.organization_id;
  const role = payload.user?.role ?? payload.role;
  const name = payload.user?.name ?? payload.name;

  const isPlatformAdmin = role === "platform_admin";
  if (!accessToken || !userId || !role || (!organizationId && !isPlatformAdmin)) {
    throw new ApiError("Invalid login response shape", 500, payload);
  }

  return {
    accessToken,
    user: {
      userId,
      organizationId: organizationId ?? null,
      role,
      name,
    },
  };
}

function readStoredSession(): SessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = readStoredSession();
    startTransition(() => {
      setSession(stored);
      setIsReady(true);
    });
  }, []);

  const login = useCallback(async (credentials: LoginRequest): Promise<UserRole> => {
    const path = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH ?? "/auth/login";
    const response = await apiClient.post<LoginResponse>(path, credentials, { auth: false });
    const mappedSession = mapLoginResponseToSession(response);

    setSession(mappedSession);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(mappedSession));
    }
    return mappedSession.user.role;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.location.assign("/login");
    }
  }, []);

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      if (!session) {
        return false;
      }
      return roles.includes(session.user.role);
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated: Boolean(session?.accessToken),
      session,
      login,
      logout,
      hasRole,
    }),
    [isReady, session, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
