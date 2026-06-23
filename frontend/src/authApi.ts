export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  companyId: string;
  companyName: string;
  role: string;
}

interface AuthResult {
  token: string;
  user: AuthUser;
}

const sidebarBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api/sidebar";
const API_ROOT = sidebarBase.endsWith("/sidebar") ? sidebarBase.slice(0, -8) : "/api";
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

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_ROOT}/auth${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  register: (data: { email: string; password: string; companyName: string; name?: string }) =>
    authRequest<AuthResult>("/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    authRequest<AuthResult>("/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => authRequest<AuthUser>("/me"),
  logout: () => authRequest<void>("/logout", { method: "POST" })
};
