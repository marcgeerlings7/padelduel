"use client";

import { BadgeCheck, Clock, Info, ShieldQuestion } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError, apiFetch } from "@/lib/client/api";
import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from "@/lib/profile/validation";
import { KNLTB_LEVELS, type MyProfileResponse } from "./types";

const NO_LEVEL = "none";

function levelLabel(level: number): string {
  if (level === 1) return "1 (sterkst)";
  if (level === 9) return "9 (beginner)";
  return String(level);
}

/**
 * Weergavenaam (verplicht) en zelf opgegeven KNLTB-speelsterkte (optioneel)
 * via PATCH /api/me/profile. Alleen gewijzigde velden worden verstuurd.
 */
export function ProfileForm({
  profile,
  onSaved,
}: {
  profile: MyProfileResponse;
  onSaved: (profile: MyProfileResponse) => void;
}) {
  const id = useId();
  const [name, setName] = useState(profile.displayName ?? "");
  const [level, setLevel] = useState<string>(profile.knltbLevel === null ? NO_LEVEL : String(profile.knltbLevel));
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savedLevel = profile.knltbLevel === null ? NO_LEVEL : String(profile.knltbLevel);
  const nameChanged = name.trim().replace(/\s+/g, " ") !== (profile.displayName ?? "");
  const levelChanged = level !== savedLevel;
  const dirty = nameChanged || levelChanged;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body: { displayName?: string; knltbLevel?: number | null } = {};
    if (nameChanged || !profile.hasDisplayName) {
      const parsed = displayNameSchema.safeParse(name);
      if (!parsed.success) {
        setNameError(parsed.error.issues[0]?.message ?? "Vul je naam in.");
        return;
      }
      body.displayName = parsed.data;
    }
    if (levelChanged) body.knltbLevel = level === NO_LEVEL ? null : Number(level);
    if (Object.keys(body).length === 0) return;

    setSaving(true);
    try {
      const updated = await apiFetch<MyProfileResponse>("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setName(updated.displayName ?? "");
      onSaved(updated);
      toast.success("Profiel opgeslagen");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Je profiel kon niet worden opgeslagen. Probeer het opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard id="profiel-gegevens" title="Gegevens" description="Je naam is zichtbaar voor andere spelers.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Weergavenaam</Label>
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={`${id}-name-hint`}
            placeholder="Bijv. Sanne de Vries"
          />
          <p id={`${id}-name-hint`} className={nameError ? "text-xs text-loss" : "text-xs text-muted-foreground"}>
            {nameError ?? `2 tot ${DISPLAY_NAME_MAX_LENGTH} tekens: letters, cijfers, spaties en . ' - _`}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-level`}>KNLTB-speelsterkte</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger id={`${id}-level`} className="w-full sm:w-64" aria-describedby={`${id}-level-hint`}>
              <SelectValue placeholder="Niet opgegeven" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LEVEL}>Niet opgegeven</SelectItem>
              {KNLTB_LEVELS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {levelLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id={`${id}-level-hint`} className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              Zelf opgegeven, geen officiële KNLTB-rating. Een nieuw duo van jou start iets hoger op de ladder als je een
              sterkere speelsterkte opgeeft (alleen zolang je nog geen gespeeld duo hebt). Laat je speelsterkte
              verifiëren voor een grotere startbonus.
            </span>
          </p>
          {!levelChanged && profile.knltbLevel !== null ? (
            <VerificationStatus profile={profile} onSaved={onSaved} />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2 text-sm text-loss">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={saving || (!dirty && profile.hasDisplayName)} className="w-full sm:w-fit">
          {saving ? "Bezig met opslaan…" : "Profiel opslaan"}
        </Button>
      </form>
    </SectionCard>
  );
}

/**
 * Laag C (akkoord PO 2026-11-22): status van de verificatie van de opgeslagen
 * speelsterkte, met een knop om verificatie aan te vragen.
 */
function VerificationStatus({
  profile,
  onSaved,
}: {
  profile: MyProfileResponse;
  onSaved: (profile: MyProfileResponse) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestVerification() {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<MyProfileResponse>("/api/me/profile/verification", { method: "POST" });
      onSaved(updated);
      toast.success("Verificatie aangevraagd");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "De aanvraag is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  if (profile.knltbVerification === "verified") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-win">
        <BadgeCheck aria-hidden className="size-4" />
        Speelsterkte geverifieerd
      </p>
    );
  }
  if (profile.knltbVerification === "requested") {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
        <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Verificatie aangevraagd. Een beheerder vraagt je per e-mail om een schermafbeelding van je speelsterkte in
          MijnKNLTB. Die bewaren we niet.
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={requestVerification}>
        <ShieldQuestion aria-hidden />
        {busy ? "Bezig…" : "Speelsterkte laten verifiëren"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
