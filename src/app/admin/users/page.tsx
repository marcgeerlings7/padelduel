"use client";

import { Search, ShieldCheck, ShieldOff, UserSearch } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/LoadingSkeletons";
import { Page } from "@/components/app/Page";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminNav } from "@/components/admin/AdminNav";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminUsers, type AdminUser } from "@/lib/client/useAdminUsers";

type PendingChange = { user: AdminUser; role: AdminUser["role"] };

export default function AdminUsersPage() {
  const { users, query, setQuery, search, setRole, busyId, loadError, actionError } = useAdminUsers();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function ask(user: AdminUser, role: AdminUser["role"]) {
    setPending({ user, role });
    setConfirmOpen(true);
  }

  const promoting = pending?.role === "ADMIN";

  return (
    <Page width="wide">
      <AdminNav />
      <PageHeader
        title="Gebruikers"
        description="Wijs admins aan of trek admin-rechten in. De laatste admin kan niet worden ingetrokken; een nieuwe admin ziet de beheermenu's na opnieuw inloggen."
      />

      <form onSubmit={search} role="search" className="flex items-end gap-2">
        <div className="grid flex-1 gap-2">
          <Label htmlFor="user-search">Zoeken op e-mailadres of naam</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="user-search"
              type="search"
              autoComplete="off"
              placeholder="Naam of e-mailadres"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" variant="secondary" className="h-11 sm:h-10">
          Zoeken
        </Button>
      </form>

      {loadError ? <AdminAlert>{loadError}</AdminAlert> : null}
      {actionError ? <AdminAlert>{actionError}</AdminAlert> : null}

      {!users && !loadError ? <TableSkeleton rows={6} label="Gebruikers laden" /> : null}

      {users && users.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title="Geen gebruikers gevonden"
          description="Controleer de spelling of zoek op een deel van het e-mailadres."
        />
      ) : null}

      {users && users.length > 0 ? (
        <SectionCard
          title={users.length === 1 ? "1 gebruiker" : `${users.length} gebruikers`}
          flush
          className="overflow-hidden"
        >
          <table className="w-full border-collapse text-left text-[0.9375rem]">
            <thead className="max-sm:sr-only">
              <tr className="border-t text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-semibold">Gebruiker</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rol</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actieve duo&apos;s</th>
                <th scope="col" className="px-5 py-2.5">
                  <span className="sr-only">Actie</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === "ADMIN";
                const busy = busyId === u.id;
                return (
                  <tr
                    key={u.id}
                    data-user-email={u.email}
                    className="border-t max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:px-4 max-sm:py-3.5 sm:hover:bg-accent/50"
                  >
                    <td className="min-w-0 sm:px-5 sm:py-3">
                      {u.displayName ? (
                        <span className="flex flex-col">
                          <span className="font-semibold break-words">{u.displayName}</span>
                          <span className="text-sm break-all text-muted-foreground">{u.email}</span>
                        </span>
                      ) : (
                        <span className="font-semibold break-all">{u.email}</span>
                      )}
                    </td>
                    <td className="max-sm:justify-self-end sm:px-3 sm:py-3">
                      <Badge variant={isAdmin ? "soft" : "muted"}>
                        {isAdmin ? <ShieldCheck aria-hidden /> : null}
                        {isAdmin ? "Admin" : "Speler"}
                      </Badge>
                    </td>
                    <td className="text-sm text-muted-foreground sm:px-3 sm:py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={u.isActive ? "size-1.5 rounded-full bg-win" : "size-1.5 rounded-full bg-warning"}
                        />
                        {u.isActive ? "Actief" : "Niet geactiveerd"}
                      </span>
                    </td>
                    <td className="text-sm text-muted-foreground max-sm:justify-self-end sm:px-3 sm:py-3 sm:text-right">
                      <span className="font-score text-lg text-foreground tabular">{u.activeDuoCount}</span>
                      <span className="sm:hidden"> {u.activeDuoCount === 1 ? "duo" : "duo's"}</span>
                    </td>
                    <td className="max-sm:col-span-2 max-sm:pt-1.5 sm:px-5 sm:py-3 sm:text-right">
                      {isAdmin ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => ask(u, "USER")}
                          className="text-destructive hover:text-destructive max-sm:w-full"
                        >
                          <ShieldOff aria-hidden />
                          Admin-rechten intrekken
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="soft"
                          size="sm"
                          disabled={busy || !u.isActive}
                          onClick={() => ask(u, "ADMIN")}
                          className="max-sm:w-full"
                        >
                          <ShieldCheck aria-hidden />
                          Maak admin
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      ) : null}

      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={promoting ? "Admin maken?" : "Admin-rechten intrekken?"}
        description={
          promoting
            ? "Deze gebruiker kan dan disputes afhandelen, API-clients beheren en andere admins aanwijzen."
            : "Deze gebruiker verliest direct de toegang tot alle beheerpagina's."
        }
        confirmLabel={promoting ? "Ja, maak admin" : "Ja, rechten intrekken"}
        tone={promoting ? "default" : "destructive"}
        onConfirm={() => {
          if (pending) void setRole(pending.user.id, pending.role);
        }}
      >
        {pending ? (
          <p className="flex flex-col rounded-lg bg-muted px-4 py-3 text-sm">
            {pending.user.displayName ? <span className="font-semibold">{pending.user.displayName}</span> : null}
            <span className={pending.user.displayName ? "break-all text-muted-foreground" : "font-semibold break-all"}>
              {pending.user.email}
            </span>
          </p>
        ) : null}
      </ConfirmSheet>
    </Page>
  );
}
