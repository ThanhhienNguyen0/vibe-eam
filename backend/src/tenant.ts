import { AsyncLocalStorage } from "node:async_hooks";

export const DEFAULT_COMPANY_ID = "company-default-demo";
export const DEFAULT_COMPANY_NAME = "Default Demo Company";

export interface AuthPrincipal {
  userId: string;
  companyId: string;
  role: string;
}

const storage = new AsyncLocalStorage<AuthPrincipal>();

export function runWithPrincipal<T>(principal: AuthPrincipal, callback: () => T): T {
  return storage.run(principal, callback);
}

export function currentPrincipal(): AuthPrincipal | undefined {
  return storage.getStore();
}

export function requireCompanyId(): string {
  const companyId = currentPrincipal()?.companyId;
  if (!companyId) throw new Error("Authenticated company context is required.");
  return companyId;
}
