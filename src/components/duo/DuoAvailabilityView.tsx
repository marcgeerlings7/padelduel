"use client";

import { Fragment, useState } from "react";
import {
  useDuoAvailability,
  DAY_LABELS,
  QUICK_SLOTS,
  AvailabilityBlock,
  AvailabilityInput,
} from "@/lib/client/useDuoAvailability";

const EMPTY_INPUT: AvailabilityInput = { dayOfWeek: 0, startTime: "19:00", endTime: "21:00", recurring: true };

/**
 * Formulier voor een vrij tijdsblok (toevoegen of bewerken). Puur
 * presentatie + lokale formulierstate; validatie en API-calls zitten in
 * useDuoAvailability.
 */
function AvailabilityForm({
  initial,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: AvailabilityInput;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: AvailabilityInput) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [input, setInput] = useState<AvailabilityInput>(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await onSubmit(input);
    if (result) setError(result);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3" style={{ fontSize: 13 }}>
      <div className="field">
        <label htmlFor={`${submitLabel}-day`}>Dag</label>
        <select
          id={`${submitLabel}-day`}
          className="input"
          value={input.dayOfWeek}
          onChange={(e) => setInput((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
        >
          {DAY_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${submitLabel}-start`}>Van</label>
        <input
          id={`${submitLabel}-start`}
          className="input"
          type="time"
          required
          value={input.startTime}
          onChange={(e) => setInput((prev) => ({ ...prev, startTime: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`${submitLabel}-end`}>Tot</label>
        <input
          id={`${submitLabel}-end`}
          className="input"
          type="time"
          required
          value={input.endTime}
          onChange={(e) => setInput((prev) => ({ ...prev, endTime: e.target.value }))}
        />
      </div>
      <label className="flex items-center gap-2" style={{ paddingBottom: 10 }}>
        <input
          type="checkbox"
          checked={input.recurring}
          onChange={(e) => setInput((prev) => ({ ...prev, recurring: e.target.checked }))}
        />
        Vast terugkerend (elke week)
      </label>
      <button type="submit" disabled={busy} className="btn btn-primary">
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Annuleren
        </button>
      )}
      {error && (
        <p style={{ color: "var(--color-accent-700)", width: "100%", margin: 0 }}>{error}</p>
      )}
    </form>
  );
}

function blockLabel(block: AvailabilityBlock): string {
  return `${DAY_LABELS[block.dayOfWeek] ?? "?"} ${block.startTime}–${block.endTime}`;
}

export function DuoAvailabilityView({ duoId }: { duoId: string }) {
  const { blocks, loadError, busyKey, findQuickSlotBlock, toggleQuickSlot, addBlock, updateBlock, removeBlock } =
    useDuoAvailability(duoId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Remount van het toevoegformulier na een geslaagde toevoeging (leegmaken).
  const [addFormKey, setAddFormKey] = useState(0);

  async function report(result: Promise<string | null>) {
    setActionError(await result);
  }

  if (loadError) {
    return <p style={{ fontSize: 14, color: "var(--color-accent-700)" }}>{loadError}</p>;
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

      {actionError && <p style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{actionError}</p>}

      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, margin: 0 }}>Snelkeuze</h2>
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
          {QUICK_SLOTS.map((slot) => (
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
                <br />
                {slot.startTime}–{slot.endTime}
              </div>
              {DAY_LABELS.map((dayLabel, dayOfWeek) => {
                const on = Boolean(findQuickSlotBlock(dayOfWeek, slot));
                return (
                  <button
                    key={`${dayOfWeek}-${slot.startTime}`}
                    type="button"
                    aria-label={`${dayLabel} ${slot.label}`}
                    disabled={busyKey === `slot-${dayOfWeek}-${slot.startTime}`}
                    onClick={() => report(toggleQuickSlot(dayOfWeek, slot))}
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

      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, margin: 0 }}>
        Alle tijdsblokken
      </h2>
      {blocks.length > 0 && (
        <ul className="flex flex-col" style={{ gap: 2 }}>
          {blocks.map((block) => (
            <li key={block.id} className="card" data-availability-block={blockLabel(block)} style={{ borderRadius: 0 }}>
              {editingId === block.id ? (
                <AvailabilityForm
                  initial={{
                    dayOfWeek: block.dayOfWeek,
                    startTime: block.startTime,
                    endTime: block.endTime,
                    recurring: block.recurring,
                  }}
                  submitLabel="Opslaan"
                  busy={busyKey === `edit-${block.id}`}
                  onSubmit={async (input) => {
                    const error = await updateBlock(block.id, input);
                    if (!error) setEditingId(null);
                    return error;
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {blockLabel(block)}{" "}
                    <span className="tag tag-outline">{block.recurring ? "Elke week" : "Niet vast terugkerend"}</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(block.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === `delete-${block.id}`}
                      onClick={() => report(removeBlock(block.id))}
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                    >
                      Verwijderen
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="card">
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14, margin: 0 }}>
          Tijdsblok toevoegen
        </h3>
        <AvailabilityForm
          key={addFormKey}
          initial={EMPTY_INPUT}
          submitLabel="Toevoegen"
          busy={busyKey === "add"}
          onSubmit={async (input) => {
            const error = await addBlock(input);
            if (!error) setAddFormKey((k) => k + 1);
            return error;
          }}
        />
      </div>
    </>
  );
}
