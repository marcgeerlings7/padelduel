"use client";

import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminNav } from "@/components/admin/AdminNav";
import { groupConfig, labelFor, unitFor, type ConfigEntry } from "@/components/admin/platformConfigGroups";
import { EmptyState } from "@/components/app/EmptyState";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";

export default function AdminPlatformConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.push("/login");
      return;
    }
    apiFetch<ConfigEntry[]>("/api/admin/platform-config")
      .then(setConfig)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setError("Alleen toegankelijk voor admins.");
          return;
        }
        setError("Kon de platform config niet laden. Vernieuw de pagina om het opnieuw te proberen.");
      });
  }, [router]);

  const groups = config ? groupConfig(config) : null;

  return (
    <Page>
      <AdminNav />
      <PageHeader
        title="Platform config"
        description="Alle instelbare parameters op één plek, nooit hardcoded in de app."
      />

      <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>Alleen-lezen. Een waarde wijzigen gaat via de tabel platform_config in de database.</p>
      </div>

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {!config && !error ? (
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={4} label="Platform config laden" />
          <CardSkeleton lines={3} />
        </div>
      ) : null}

      {groups && groups.length === 0 ? (
        <EmptyState compact title="Geen parameters gevonden" description="De tabel platform_config is leeg." />
      ) : null}

      {groups?.map((group) => (
        <SectionCard key={group.id} title={group.title} description={group.description} flush>
          <dl>
            {group.entries.map((entry) => {
              const unit = unitFor(entry.key, entry.value);
              return (
                <div
                  key={entry.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-t px-4 py-3.5 sm:px-5"
                >
                  <dt className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold break-words">{labelFor(entry.key)}</span>
                    {entry.description ? (
                      <span className="text-sm text-muted-foreground">{entry.description}</span>
                    ) : null}
                    <span className="font-mono text-xs break-all text-muted-foreground/90">{entry.key}</span>
                  </dt>
                  <dd className="flex items-baseline gap-1 text-right whitespace-nowrap">
                    <span className="font-score text-3xl leading-none">{entry.value}</span>
                    {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </SectionCard>
      ))}
    </Page>
  );
}
