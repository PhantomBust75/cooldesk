import type { SessionState } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const SESSION_STORAGE_KEY = "cooldesk.session";

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function readSessionFromStorage(): SessionState | null {
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

type RequestOptions = {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
};

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { auth = true, body, headers = {}, params } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = params
    ? new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  const fullPath = queryString ? `${normalizedPath}?${queryString}` : normalizedPath;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    const session = readSessionFromStorage();
    if (session?.accessToken) {
      requestHeaders.Authorization = `Bearer ${session.accessToken}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${fullPath}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const textPayload = await response.text();
  const payload = textPayload ? safelyParseJson(textPayload) : null;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

function safelyParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, options),
};

export { SESSION_STORAGE_KEY };
