"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert, Loader2 } from "lucide-react";
import { useHydrated } from "@/lib/client/useHydrated";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken, setStoredToken } from "@/lib/client/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useHydrated();
  const id = useId();
  const errorId = `${id}-error`;

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(result.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold tracking-tight">Inloggen</h1>
        <p className="text-muted-foreground">
          Nog geen account?{" "}
          <Link href="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            Account aanmaken
          </Link>
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-email`}>E-mailadres</Label>
          <Input
            id={`${id}-email`}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jij@voorbeeld.nl"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-password`}>Wachtwoord</Label>
          <PasswordInput
            id={`${id}-password`}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        {error ? (
          <div
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-loss/30 bg-loss-soft px-3 py-2.5 text-sm text-loss"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting || !hydrated} className="mt-1 w-full">
          {submitting ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Bezig…
            </>
          ) : (
            "Inloggen"
          )}
        </Button>
      </form>

      <aside aria-label="Testaccount" className="rounded-lg border border-dashed px-4 py-3 text-sm">
        <p className="font-semibold">Testaccount</p>
        <p className="mt-0.5 text-muted-foreground">
          <span className="tabular">user1@example.com</span> met wachtwoord{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5 text-[0.8125rem] text-foreground">PadelTest123!</code>
        </p>
      </aside>
    </AuthLayout>
  );
}
