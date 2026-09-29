"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/client/api";

/**
 * Reden invullen en een dispute openen (match-score of forfeit). Een admin
 * beoordeelt hem daarna. e2e-contract: één `textarea` en de knop "Dispute openen".
 */
export function DisputeForm({
  submitPath,
  label,
  hint,
  onSubmitted,
}: {
  submitPath: string;
  label: string;
  hint?: string;
  onSubmitted: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Beschrijf kort wat er niet klopt, zodat de admin het kan beoordelen.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(submitPath, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "De dispute kon niet worden verstuurd. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft/50 p-3 sm:p-4">
      <div className="grid gap-2">
        <Label htmlFor={`${id}-reason`}>{label}</Label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
        <Textarea
          id={`${id}-reason`}
          required
          rows={3}
          maxLength={1000}
          value={reason}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Bijvoorbeeld: de derde set eindigde in 7-5, niet in 5-7."
          className="bg-card"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-loss">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={submitting} className="w-full sm:w-fit">
        {submitting ? "Bezig…" : "Dispute openen"}
      </Button>
    </form>
  );
}
