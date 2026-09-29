"use client";

import { CircleCheck, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DUO_CATEGORY_LABELS, type DuoCategory } from "@/components/dashboard/types";
import { NativeSelect } from "@/components/ladder/NativeSelect";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };

const CATEGORY_OPTIONS: { value: DuoCategory | ""; label: string }[] = [
  { value: "", label: "Geen" },
  ...(Object.keys(DUO_CATEGORY_LABELS) as DuoCategory[]).map((value) => ({
    value,
    label: DUO_CATEGORY_LABELS[value],
  })),
];

export default function ProposeDuoPage() {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [regionSlug, setRegionSlug] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [duoName, setDuoName] = useState("");
  const [category, setCategory] = useState<DuoCategory | "">("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<Region[]>("/api/regions")
      .then((data) => {
        setRegions(data);
        if (data.length > 0) setRegionSlug(data[0].slug);
      })
      .catch(() => {
        setRegions([]);
        setLoadError("Kon de regio's niet laden. Ververs de pagina om het opnieuw te proberen.");
      });
  }, [router]);

  async function handleSuggestName() {
    setSuggesting(true);
    try {
      const result = await apiFetch<{ name: string }>("/api/duos/name-suggestion");
      setDuoName(result.name);
    } catch {
      // gimmick, geen harde fout nodig als dit een keer mislukt
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/duos/propose", {
        method: "POST",
        body: JSON.stringify({
          regionSlug,
          invitedEmail,
          duoName: duoName.trim() || undefined,
          category: category || undefined,
        }),
      });
      setSentTo(invitedEmail);
      setInvitedEmail("");
      setDuoName("");
      setCategory("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Versturen is mislukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader
        title="Duo voorstellen"
        description="Nodig je padelpartner uit. Zodra die accepteert, staan jullie samen op de ladder van de gekozen regio."
        back={{ href: "/dashboard", label: "Mijn duo's" }}
      />

      {sentTo ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-win/30 bg-win-soft p-4 text-sm text-win"
        >
          <p className="flex items-start gap-2">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">Voorstel verstuurd</span> naar {sentTo}. Zodra je partner
              accepteert, zien jullie het duo terug op je dashboard.
            </span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pl-6">
            <Link href="/duos/invitations" className="font-semibold underline underline-offset-4">
              Mijn uitnodigingen
            </Link>
            <Link href="/dashboard" className="font-semibold underline underline-offset-4">
              Naar mijn duo&apos;s
            </Link>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-4 py-3 text-sm text-loss">
          {loadError}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-xl border bg-card p-4 shadow-card sm:p-5"
      >
        <div className="grid gap-2">
          <Label htmlFor="propose-region">Regio</Label>
          {regions === null ? (
            <Skeleton className="h-11 w-full sm:h-10" />
          ) : (
            <NativeSelect
              id="propose-region"
              value={regionSlug}
              onChange={(e) => setRegionSlug(e.target.value)}
              required
            >
              {regions.map((region) => (
                <option key={region.id} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="propose-email">E-mailadres van je partner</Label>
          <Input
            id="propose-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder="partner@voorbeeld.nl"
            value={invitedEmail}
            onChange={(e) => setInvitedEmail(e.target.value)}
            aria-describedby="propose-email-hint"
          />
          <p id="propose-email-hint" className="text-xs text-muted-foreground">
            Je partner moet al een account hebben.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="propose-name">
            Duo-naam <span className="font-normal text-muted-foreground">(optioneel)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="propose-name"
              type="text"
              maxLength={100}
              autoComplete="off"
              value={duoName}
              onChange={(e) => setDuoName(e.target.value)}
              placeholder="Laat leeg om er één te laten verzinnen"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggestName}
              disabled={suggesting}
              className="h-11 shrink-0 sm:h-10"
            >
              🎲 Verzin
            </Button>
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm leading-none font-medium">
            Speltype <span className="font-normal text-muted-foreground">(optioneel)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORY_OPTIONS.map((option) => (
              <label
                key={option.value || "none"}
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-semibold transition-colors",
                  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  category === option.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-input bg-card text-foreground hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="category"
                  value={option.value}
                  checked={category === option.value}
                  onChange={() => setCategory(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Alleen ter info; het heeft geen invloed op wie je kunt uitdagen.</p>
        </fieldset>

        {error ? (
          <div role="alert" className="rounded-lg border border-loss/30 bg-loss-soft px-3 py-2.5 text-sm text-loss">
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting || !regionSlug} className="w-full">
          <Send aria-hidden />
          {submitting ? "Versturen…" : "Voorstel versturen"}
        </Button>
      </form>
    </Page>
  );
}
