"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export type AdminVerificationRequest = {
  userId: string;
  email: string;
  displayName: string | null;
  knltbLevel: number;
  requestedAt: string;
  bonusIfVerified: number;
  bonusNow: number;
};

export type AdminStartRatingRegion = { id: string; name: string; unplayedDuoCount: number };

export type StartRatingChange = { duoId: string; duoName: string; from: number; to: number };
export type RecalculateResult = { checked: number; changed: StartRatingChange[] };

type Overview = { requests: AdminVerificationRequest[]; regions: AdminStartRatingRegion[] };

/**
 * Data + acties voor /admin/start-ratings (akkoord PO 2026-11-22): speelsterkte-
 * verificaties afhandelen (laag C) en startratings per regio herberekenen (laag D).
 */
export function useAdminStartRatings() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ label: string; result: RecalculateResult } | null>(null);

  const reload = useCallback(() => {
    apiFetch<Overview>("/api/admin/start-ratings")
      .then((data) => {
        setOverview(data);
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
        setLoadError("Kon de gegevens niet laden.");
      });
  }, [router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
  }, [router, reload]);

  async function decide(request: AdminVerificationRequest, decision: "approve" | "reject") {
    setBusyKey(request.userId);
    setActionError(null);
    setLastResult(null);
    try {
      const res = await apiFetch<{ status: string; recalculated: RecalculateResult | null }>(
        `/api/admin/start-ratings/verifications/${request.userId}`,
        { method: "POST", body: JSON.stringify({ decision }) },
      );
      if (res.recalculated) {
        setLastResult({ label: request.displayName ?? request.email, result: res.recalculated });
      }
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setBusyKey(null);
    }
  }

  async function recalculate(region: AdminStartRatingRegion) {
    setBusyKey(region.id);
    setActionError(null);
    setLastResult(null);
    try {
      const result = await apiFetch<RecalculateResult>("/api/admin/start-ratings/recalculate", {
        method: "POST",
        body: JSON.stringify({ regionId: region.id }),
      });
      setLastResult({ label: region.name, result });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setBusyKey(null);
    }
  }

  return { overview, loadError, actionError, busyKey, lastResult, decide, recalculate };
}
