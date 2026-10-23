import { useEffect, useState } from "react";
import { API_ROOT, apiRequest, type AuthUser } from "./authApi";
import { ROLES, ROLE_LABELS, isRole, useAccess, type Role } from "./access";

export default function UserManagement({ onRoleChanged }: { onRoleChanged: () => void }) {
  const { canManageUsers } = useAccess();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("Viewer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (canManageUsers) apiRequest<AuthUser[]>(`${API_ROOT}/users`).then(setUsers).catch((e) => setError(e.message));
  }, [canManageUsers]);
  if (!canManageUsers) return null;

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const created = await apiRequest<AuthUser>(`${API_ROOT}/users`, { method: "POST", body: JSON.stringify({ email, name, password, role }) });
      setUsers((previous) => [...previous, created]); setEmail(""); setName(""); setRole("Viewer");
    } catch (e) { setError(e instanceof Error ? e.message : "Nutzer konnte nicht angelegt werden."); }
    finally { setPassword(""); setBusy(false); }
  }

  async function changeRole(user: AuthUser, next: string) {
    if (!isRole(next)) return;
    setBusy(true); setError("");
    try {
      const updated = await apiRequest<AuthUser>(`${API_ROOT}/users/${encodeURIComponent(user.id)}/role`, { method: "PATCH", body: JSON.stringify({ role: next }) });
      setUsers((previous) => previous.map((entry) => entry.id === updated.id ? updated : entry));
      onRoleChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Rolle konnte nicht geändert werden."); }
    finally { setBusy(false); }
  }

  return <section className="home-view" aria-label="Nutzerverwaltung">
    <h2>Nutzerverwaltung</h2>
    {error && <div role="alert" className="error-banner">{error}</div>}
    <table><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th></tr></thead><tbody>
      {users.map((user) => <tr key={user.id}><td>{user.name ?? "—"}</td><td>{user.email}</td><td>
        <select aria-label={`Rolle für ${user.email}`} disabled={busy} value={user.role} onChange={(e) => void changeRole(user, e.target.value)}>
          {ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
        </select>
      </td></tr>)}
    </tbody></table>
    <form className="sb-form" onSubmit={create}>
      <h3>Lokalen Nutzer anlegen</h3>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
      <label>E-Mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" /></label>
      <label>Initiales Passwort<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
      <label>Rolle<select value={role} onChange={(e) => { if (isRole(e.target.value)) setRole(e.target.value); }}>
        {ROLES.map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
      </select></label>
      <button disabled={busy}>Nutzer anlegen</button>
    </form>
  </section>;
}
