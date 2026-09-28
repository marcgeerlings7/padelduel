"use client";

import { useAdminUsers } from "@/lib/client/useAdminUsers";

export default function AdminUsersPage() {
  const { users, query, setQuery, search, setRole, busyId, loadError, actionError } = useAdminUsers();

  if (loadError) {
    return (
      <main className="px-4 py-8 sm:px-8" style={{ fontSize: 14, color: "var(--color-accent-700)" }}>
        {loadError}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="tag tag-accent" style={{ marginBottom: 10 }}>
        Beheerder
      </div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: 0 }}>
        Gebruikers
      </h1>
      <p style={{ color: "var(--color-neutral-700)", fontSize: 14, margin: 0, maxWidth: "60ch" }}>
        Wijs admins aan of trek admin-rechten in. De laatste admin kan niet worden ingetrokken. Een
        nieuwe admin ziet de admin-menu-items na opnieuw inloggen.
      </p>
      <div className="hr" style={{ margin: 0 }} />

      <form onSubmit={search} className="flex flex-wrap items-end gap-2">
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label htmlFor="user-search">Zoeken op e-mailadres</label>
          <input
            id="user-search"
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-secondary">
          Zoeken
        </button>
      </form>

      {actionError && (
        <p role="alert" style={{ color: "var(--color-accent-700)", fontSize: 13, margin: 0 }}>
          {actionError}
        </p>
      )}

      {!users && <p className="text-sm">Laden...</p>}
      {users && users.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>Geen gebruikers gevonden.</p>}

      {users && users.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>E-mailadres</th>
                <th>Rol</th>
                <th>Status</th>
                <th>Actieve duo&apos;s</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} data-user-email={u.email}>
                  <td>{u.email}</td>
                  <td>
                    <span className={`tag ${u.role === "ADMIN" ? "tag-accent" : "tag-outline"}`}>
                      {u.role === "ADMIN" ? "Admin" : "Speler"}
                    </span>
                  </td>
                  <td>{u.isActive ? "Actief" : "Niet geactiveerd"}</td>
                  <td>{u.activeDuoCount}</td>
                  <td>
                    {u.role === "ADMIN" ? (
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => setRole(u.id, "USER")}
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                      >
                        Admin-rechten intrekken
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === u.id || !u.isActive}
                        onClick={() => setRole(u.id, "ADMIN")}
                        className="btn btn-primary"
                        style={{ fontSize: 12 }}
                      >
                        Maak admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
