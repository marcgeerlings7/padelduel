"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client/api";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Status = "activating" | "success" | "error";

const TITLES: Record<Status, string> = {
  activating: "Account activeren…",
  success: "Account geactiveerd",
  error: "Activeren mislukt",
};

function StatusIcon({ status }: { status: Status }) {
  const Icon = status === "success" ? CircleCheck : status === "error" ? CircleX : Loader2;
  return (
    <span
      className={cn(
        "flex size-14 items-center justify-center rounded-2xl",
        status === "success" && "bg-win-soft text-win",
        status === "error" && "bg-loss-soft text-loss",
        status === "activating" && "bg-primary-soft text-primary",
      )}
    >
      <Icon aria-hidden className={cn("size-7", status === "activating" && "animate-spin")} />
    </span>
  );
}

function ActivateContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("activating");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Deze activatielink mist een token. Vraag een nieuwe activatielink aan.");
      return;
    }
    apiFetch<{ message: string }>("/api/auth/activate", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        setStatus("success");
        setMessage(result.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
      });
  }, [token]);

  return (
    <ActivateView status={status}>
      {message ? (
        <p className="text-muted-foreground">{message}</p>
      ) : (
        <p className="text-muted-foreground">Even geduld, we controleren je activatielink.</p>
      )}
      {status === "success" ? (
        <Button asChild size="lg" className="w-full no-underline">
          <Link href="/login">Naar inloggen</Link>
        </Button>
      ) : null}
      {status === "error" ? (
        <div className="flex flex-col gap-2">
          <Button asChild size="lg" variant="outline" className="w-full no-underline">
            <Link href="/register">Nieuw account aanmaken</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Heb je je account al geactiveerd?{" "}
            <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
              Inloggen
            </Link>
          </p>
        </div>
      ) : null}
    </ActivateView>
  );
}

function ActivateView({ status, children }: { status: Status; children?: React.ReactNode }) {
  return (
    <AuthLayout>
      <div className="flex flex-col gap-4" aria-live="polite">
        <StatusIcon status={status} />
        <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold tracking-tight">{TITLES[status]}</h1>
        {children}
      </div>
    </AuthLayout>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <ActivateView status="activating">
          <Skeleton className="h-4 w-3/4" />
        </ActivateView>
      }
    >
      <ActivateContent />
    </Suspense>
  );
}
