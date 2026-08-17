"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export type MyDuo = { id: string; name: string; regionId: string; tier: number };

export function useMyDuos() {
  const router = useRouter();
  const [duos, setDuos] = useState<MyDuo[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<MyDuo[]>("/api/duos/mine")
      .then((data) => {
        setDuos(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon je duo's niet laden.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return { duos, selectedId, setSelectedId, error };
}
