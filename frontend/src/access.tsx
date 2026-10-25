import { createContext, useContext } from "react";
import { permits, type Role } from "../../backend/src/auth/policy";

export { ROLES, isRole, type Role } from "../../backend/src/auth/policy";
export const ROLE_LABELS: Record<Role, string> = { Admin: "Admin", Architect: "Architekt", Viewer: "Viewer (nur lesen)" };
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Admin: "Kann Nutzer und Rollen, das Metamodell sowie Architektur und Diagramme verwalten.",
  Architect: "Kann Architektur, Beziehungen und Diagramme bearbeiten, aber keine Nutzer oder Rollen verwalten.",
  Viewer: "Kann Architektur und Diagramme ansehen, aber keine Daten verändern."
};
export const AccessContext = createContext<Role | null>(null);

export function useAccess() {
  const role = useContext(AccessContext);
  return {
    canWrite: permits(role, "architecture:write"),
    canManageMetamodel: permits(role, "metamodel:write"),
    canManageUsers: permits(role, "users:manage")
  };
}
