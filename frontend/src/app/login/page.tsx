"use client";
import { useEffect } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";
import type { LoginRequest } from "@/types/auth";
import { Eye, EyeOff, Lock, Zap } from "lucide-react";
import { useSnackbar } from "notistack";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";

const INITIAL_FORM: LoginRequest = {
  email: "",
  password: "",
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isReady } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [form, setForm] = useState<LoginRequest>(INITIAL_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const hasHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next");
    if (requested && requested.startsWith("/")) {
      return requested;
    }
    return "/dashboard";
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isReady, isAuthenticated, router, nextPath]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired") === "1") {
      enqueueSnackbar("Your session has expired. Please log in again.", { variant: "warning" });
    }
    // Run once on mount only — this reflects how the user arrived at the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRedirecting = useMemo(
    () => isReady && isAuthenticated,
    [isReady, isAuthenticated],
  );

  if (isRedirecting) {
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const role = await login(form);
      enqueueSnackbar("Logged in successfully", { variant: "success" });
      router.replace(role === "dealer" ? "/dealer/jobs" : nextPath);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : "Unable to login at the moment.";
      setErrorMessage(msg);
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAFAFA",
        padding: "24px",
      }}
    >
      <div style={{ width: "400px", maxWidth: "95vw" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <Zap size={22} strokeWidth={1.5} color="#0A0A0A" />
            <span
              style={{
                fontSize: "20px",
                fontWeight: 500,
                color: "#0A0A0A",
                letterSpacing: "-0.01em",
              }}
            >
              CoolDesk
            </span>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "#737373",
              margin: "4px 0 0",
              fontWeight: 400,
            }}
          >
            AC service management platform
          </p>
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "28px",
            border: "1px solid #E5E5E5",
          }}
        >
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "#171717",
              margin: "0 0 22px",
              textAlign: "center",
            }}
          >
            Sign in to your account
          </h2>

          {hasHydrated ? (
            <form
              className="keeper-ignore"
              data-lpignore="true"
              data-1p-ignore="true"
              onSubmit={onSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#404040",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Email address <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #E5E5E5",
                    borderRadius: "8px",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    color: "#171717",
                    fontFamily: "inherit",
                  }}
                  onFocus={(event) =>
                    (event.currentTarget.style.borderColor = "#A3A3A3")
                  }
                  onBlur={(event) =>
                    (event.currentTarget.style.borderColor = "#E5E5E5")
                  }
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#404040",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Password <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "10px 40px 10px 12px",
                      border: "1px solid #E5E5E5",
                      borderRadius: "8px",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                      color: "#171717",
                      fontFamily: "inherit",
                    }}
                    onFocus={(event) =>
                      (event.currentTarget.style.borderColor = "#A3A3A3")
                    }
                    onBlur={(event) =>
                      (event.currentTarget.style.borderColor = "#E5E5E5")
                    }
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#A3A3A3",
                      lineHeight: 0,
                    }}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={15} strokeWidth={1.5} />
                    ) : (
                      <Eye size={15} strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <div
                  style={{
                    padding: "9px 12px",
                    backgroundColor: "#FEE2E2",
                    borderRadius: "8px",
                    fontSize: "13px",
                    color: "#991B1B",
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <Lock size={14} strokeWidth={1.5} />
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "11px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isSubmitting ? "#A3A3A3" : "#0A0A0A",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  marginTop: "4px",
                  minHeight: "44px",
                }}
              >
                <Lock size={14} strokeWidth={1.5} />
                {isSubmitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <div style={{ height: "229px" }} aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  );
}
