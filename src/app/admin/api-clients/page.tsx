"use client";

import { Check, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminNav } from "@/components/admin/AdminNav";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { NativeSelect } from "@/components/availability/NativeSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

type Region = { id: string; name: string; slug: string };
type ApiClientSummary = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
  region: Region | null;
};
type ConfigEntry = { key: string; value: string };

const dateFormat = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export default function AdminApiClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ApiClientSummary[] | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [rateLimit, setRateLimit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [confirmClient, setConfirmClient] = useState<ApiClientSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reload = useCallback(() => {
    apiFetch<ApiClientSummary[]>("/api/admin/api-clients")
      .then(setClients)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de API-clients niet laden. Vernieuw de pagina om het opnieuw te proberen.");
      });
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    reload();
    apiFetch<Region[]>("/api/regions")
      .then(setRegions)
      .catch(() => setRegions([]));
    // Alleen ter informatie: de geldende limiet uit platform_config.
    apiFetch<ConfigEntry[]>("/api/admin/platform-config")
      .then((config) => setRateLimit(config.find((c) => c.key === "availability_api_rate_limit_per_minute")?.value ?? null))
      .catch(() => setRateLimit(null));
  }, [router, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNewKey(null);
    setCopied(false);
    setCreating(true);
    try {
      const result = await apiFetch<{ plaintextKey: string }>("/api/admin/api-clients", {
        method: "POST",
        body: JSON.stringify({ name, regionId: regionId || undefined }),
      });
      setNewKey(result.plaintextKey);
      setName("");
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Aanmaken is mislukt. Probeer het opnieuw.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    setRevokeError(null);
    try {
      await apiFetch(`/api/admin/api-clients/${id}/revoke`, { method: "POST" });
      reload();
    } catch (err) {
      setRevokeError(err instanceof ApiError ? err.message : "Intrekken is mislukt. Probeer het opnieuw.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      toast.success("API-key gekopieerd");
    } catch {
      toast.error("Kopiëren lukt niet in deze browser. Selecteer de key en kopieer handmatig.");
    }
  }

  const sorted = clients ? [...clients].sort((a, b) => Number(b.isActive) - Number(a.isActive)) : null;
  const activeCount = clients?.filter((c) => c.isActive).length ?? 0;

  return (
    <Page>
      <AdminNav />
      <PageHeader
        title="API-clients"
        description="Externe partijen, zoals clubs, lezen via de API alleen duo-naam, regio en tijdsblokken. Nooit e-mailadressen of gebruikers-id's."
        meta={
          <>
            {clients ? <Badge variant="soft">{activeCount} actief</Badge> : null}
            {rateLimit ? <Badge variant="muted">Limiet {rateLimit} aanroepen per minuut per client</Badge> : null}
          </>
        }
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}

      {newKey ? (
        <SectionCard
          variant="court"
          title="Nieuwe API-key"
          description="Deze key wordt maar één keer getoond. Kopieer hem nu en geef hem veilig door."
        >
          <div className="flex flex-col gap-3">
            <code className="block rounded-lg bg-[rgb(0_0_0/0.25)] px-3 py-3 font-mono text-sm leading-relaxed break-all text-court-foreground select-all">
              {newKey}
            </code>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ball" onClick={copyKey} className="sm:flex-1">
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Gekopieerd" : "Kopieer key"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewKey(null)}
                className="text-court-foreground hover:bg-white/10 hover:text-court-foreground"
              >
                Ik heb hem bewaard
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Nieuwe API-client" description="Na aanmaken krijg je de key één keer te zien.">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Naam</Label>
              <Input
                id="client-name"
                type="text"
                required
                maxLength={150}
                autoComplete="off"
                placeholder="Bijv. Padelclub De Smash"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-region">Regio</Label>
              <NativeSelect id="client-region" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                <option value="">Alle regio&apos;s</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {formError ? <AdminAlert>{formError}</AdminAlert> : null}
          <Button type="submit" disabled={creating} className="w-full sm:w-fit">
            {creating ? <Loader2 aria-hidden className="animate-spin" /> : <KeyRound aria-hidden />}
            Aanmaken
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Clients" flush>
        {revokeError ? <AdminAlert className="mx-4 mb-3 sm:mx-5">{revokeError}</AdminAlert> : null}
        {!sorted && !error ? <ListSkeleton rows={3} label="API-clients laden" className="px-4 pb-4" /> : null}
        {sorted && sorted.length === 0 ? (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <EmptyState
              compact
              icon={KeyRound}
              title="Nog geen API-clients"
              description="Maak hierboven een client aan voor een club of partner die beschikbaarheid wil tonen."
            />
          </div>
        ) : null}
        {sorted && sorted.length > 0 ? (
          <ul>
            {sorted.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t px-4 py-3 sm:px-5">
                <span
                  aria-hidden
                  className={
                    c.isActive
                      ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"
                      : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  }
                >
                  <KeyRound className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant={c.isActive ? "win" : "muted"}>{c.isActive ? "Actief" : "Ingetrokken"}</Badge>
                    <span>{c.region?.name ?? "Alle regio's"}</span>
                    <span>
                      {c.isActive || !c.revokedAt
                        ? `Sinds ${dateFormat.format(new Date(c.createdAt))}`
                        : `Tot ${dateFormat.format(new Date(c.revokedAt))}`}
                    </span>
                  </div>
                </div>
                {c.isActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === c.id}
                    onClick={() => {
                      setConfirmClient(c);
                      setConfirmOpen(true);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    {busyId === c.id ? <Loader2 aria-hidden className="animate-spin" /> : null}
                    Intrekken
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Toegang van ${confirmClient?.name ?? "deze client"} intrekken?`}
        description="De API-key werkt direct niet meer. Dit kun je niet terugdraaien; maak zo nodig later een nieuwe client aan."
        confirmLabel="Definitief intrekken"
        tone="destructive"
        onConfirm={() => {
          if (confirmClient) void handleRevoke(confirmClient.id);
        }}
      >
        <div className="flex items-start gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>Toepassingen die deze key gebruiken krijgen vanaf nu een foutmelding.</p>
        </div>
      </ConfirmSheet>
    </Page>
  );
}
