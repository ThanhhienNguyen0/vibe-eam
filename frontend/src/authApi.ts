import type { Role } from "./access";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: Role;
}

interface AuthResult {
  token: string;
  user: AuthUser;
}

const sidebarBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/sidebar";
export const API_ROOT = sidebarBase.endsWith("/sidebar") ? sidebarBase.slice(0, -8) : "/api";
const TOKEN_KEY = "eam.auth.token";

export function getAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function handleAuthStatus(status: number): void {
  if (status === 401) {
    clearAuthToken();
    window.dispatchEvent(new Event("eam:unauthorized"));
  } else if (status === 403) {
    window.dispatchEvent(new Event("eam:forbidden"));
  }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    if (response.status !== 403 || !url.endsWith("/auth/me")) handleAuthStatus(response.status);
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, (body as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const authRequest = <T,>(path: string, init?: RequestInit) => apiRequest<T>(`${API_ROOT}/auth${path}`, init);

export const authApi = {
  register: (data: { email: string; password: string; companyName: string; name?: string }) =>
    authRequest<AuthResult>("/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    authRequest<AuthResult>("/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => authRequest<AuthUser>("/me"),
  logout: () => authRequest<void>("/logout", { method: "POST" })
};
