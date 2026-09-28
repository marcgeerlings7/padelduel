"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { validateAvailabilityInput } from "@/lib/availability/validation";

export const DAY_LABELS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

/** Snelkeuze-dagdelen voor het weekrooster (US-H1); vrije tijden kunnen daarnaast. */
export const QUICK_SLOTS = [
  { label: "Ochtend", startTime: "08:00", endTime: "12:00" },
  { label: "Middag", startTime: "12:00", endTime: "18:00" },
  { label: "Avond", startTime: "18:00", endTime: "22:00" },
] as const;
export type QuickSlot = (typeof QUICK_SLOTS)[number];

export type AvailabilityBlock = {
  id: string;
  dayOfWeek: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  recurring: boolean;
};

export type AvailabilityInput = Omit<AvailabilityBlock, "id">;

/**
 * Data + acties voor het beschikbaarheidsbeheer van één duo (US-H1/H2).
 * Beide duo-leden kunnen blokken toevoegen, bewerken en verwijderen (de
 * API controleert lidmaatschap server-side).
 */
export function useDuoAvailability(duoId: string) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setBlocks(await apiFetch<AvailabilityBlock[]>(`/api/duos/${duoId}/availability`));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setLoadError("Kon de beschikbaarheid niet laden.");
    }
  }, [duoId, router]);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    setBlocks(null);
    setLoadError(null);
    void reload();
  }, [router, reload]);

  /** Blok dat exact overeenkomt met een snelkeuze-dagdeel (dag + begin + eind). */
  function findQuickSlotBlock(dayOfWeek: number, slot: QuickSlot): AvailabilityBlock | undefined {
    return blocks?.find(
      (b) => b.dayOfWeek === dayOfWeek && b.startTime === slot.startTime && b.endTime === slot.endTime,
    );
  }

  async function run(key: string, action: () => Promise<unknown>): Promise<string | null> {
    setBusyKey(key);
    try {
      await action();
      await reload();
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.message : "Er is iets misgegaan.";
    } finally {
      setBusyKey(null);
    }
  }

  function toggleQuickSlot(dayOfWeek: number, slot: QuickSlot): Promise<string | null> {
    const existing = findQuickSlotBlock(dayOfWeek, slot);
    return run(`slot-${dayOfWeek}-${slot.startTime}`, () =>
      existing
        ? apiFetch(`/api/availability/${existing.id}`, { method: "DELETE" })
        : apiFetch(`/api/duos/${duoId}/availability`, {
            method: "POST",
            body: JSON.stringify({ dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, recurring: true }),
          }),
    );
  }

  async function addBlock(input: AvailabilityInput): Promise<string | null> {
    const invalid = validateAvailabilityInput(input);
    if (invalid) return invalid;
    return run("add", () =>
      apiFetch(`/api/duos/${duoId}/availability`, { method: "POST", body: JSON.stringify(input) }),
    );
  }

  async function updateBlock(id: string, input: AvailabilityInput): Promise<string | null> {
    const invalid = validateAvailabilityInput(input);
    if (invalid) return invalid;
    return run(`edit-${id}`, () =>
      apiFetch(`/api/availability/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    );
  }

  function removeBlock(id: string): Promise<string | null> {
    return run(`delete-${id}`, () => apiFetch(`/api/availability/${id}`, { method: "DELETE" }));
  }

  return {
    blocks,
    loadError,
    busyKey,
    findQuickSlotBlock,
    toggleQuickSlot,
    addBlock,
    updateBlock,
    removeBlock,
  };
}
