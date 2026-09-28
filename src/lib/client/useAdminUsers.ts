"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export type AdminUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  activeDuoCount: number;
};

/**
 * Data + acties voor /admin/users. Alle logica zit hier, zodat de pagina
 * puur presentatie is (en bij een UI-redesign ongewijzigd herbruikbaar).
 */
export function useAdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(
    (search: string) => {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      apiFetch<AdminUser[]>(`/api/admin/users${qs}`)
        .then((data) => {
          setUsers(data);
          setLoadError(null);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            router.push("/login");
            return;
          }
          if (err instanceof ApiError && err.status === 403) {
            setLoadError("Alleen toegankelijk voor admins.");
            return;
          }
          setLoadError("Kon de gebruikers niet laden.");
        });
    },
    [router],
  );

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload("");
  }, [router, reload]);

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    reload(query);
  }

  async function setRole(userId: string, role: AdminUser["role"]) {
    setBusyId(userId);
    setActionError(null);
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      reload(query);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setBusyId(null);
    }
  }

  return { users, query, setQuery, search, setRole, busyId, loadError, actionError };
}
