"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

const DAY_LABELS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

const SLOTS = [
  { label: "Ochtend", startTime: "08:00", endTime: "12:00" },
  { label: "Middag", startTime: "12:00", endTime: "18:00" },
  { label: "Avond", startTime: "18:00", endTime: "22:00" },
];

type AvailabilityBlock = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurring: boolean;
};

export function DuoAvailabilityView({ duoId }: { duoId: string }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<AvailabilityBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function reload() {
    apiFetch<AvailabilityBlock[]>(`/api/duos/${duoId}/availability`)
      .then(setBlocks)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError("Kon de beschikbaarheid niet laden.");
      });
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    setBlocks(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duoId, router]);

  async function toggleCell(dayOfWeek: number, slot: (typeof SLOTS)[number]) {
    const key = `${dayOfWeek}-${slot.startTime}`;
    const existing = blocks?.find(
      (b) => b.dayOfWeek === dayOfWeek && b.startTime.slice(0, 5) === slot.startTime,
    );
    setBusyKey(key);
    try {
      if (existing) {
        await apiFetch(`/api/availability/${existing.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/api/duos/${duoId}/availability`, {
          method: "POST",
          body: JSON.stringify({
            dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            recurring: true,
          }),
        });
      }
      reload();
    } finally {
      setBusyKey(null);
    }
  }

  if (error) {
    return <p style={{ fontSize: 14, color: "var(--color-accent-700)" }}>{error}</p>;
  }
  if (!blocks) {
    return <p className="text-sm">Laden...</p>;
  }

  return (
    <>
      {blocks.length === 0 && (
        <p className="text-muted" style={{ fontSize: 13 }}>
          Nog geen beschikbaarheid doorgegeven.
        </p>
      )}

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `120px repeat(${DAY_LABELS.length}, 1fr)`,
            gap: 2,
            background: "var(--color-divider)",
            minWidth: 720,
          }}
        >
          <div style={{ background: "var(--color-bg)", padding: 10 }} />
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                background: "var(--color-bg)",
                padding: 10,
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {label}
            </div>
          ))}
          {SLOTS.map((slot) => (
            <Fragment key={slot.label}>
              <div
                style={{
                  background: "var(--color-bg)",
                  padding: 10,
                  fontSize: 13,
                  color: "var(--color-neutral-700)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {slot.label}
              </div>
              {DAY_LABELS.map((dayLabel, dayOfWeek) => {
                const key = `${dayOfWeek}-${slot.startTime}`;
                const existing = blocks.find(
                  (b) => b.dayOfWeek === dayOfWeek && b.startTime.slice(0, 5) === slot.startTime,
                );
                const on = Boolean(existing);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`${dayLabel} ${slot.label}`}
                    disabled={busyKey === key}
                    onClick={() => toggleCell(dayOfWeek, slot)}
                    style={{
                      background: on ? "var(--color-accent)" : "var(--color-bg)",
                      color: on ? "var(--color-bg)" : "var(--color-text)",
                      border: "none",
                      padding: "16px 4px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {on ? "Beschikbaar" : ""}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
