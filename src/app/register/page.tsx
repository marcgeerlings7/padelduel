"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, CircleAlert, Loader2, MailCheck, MailWarning } from "lucide-react";
import { useHydrated } from "@/lib/client/useHydrated";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from "@/lib/profile/validation";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

function isPasswordComplexEnough(password: string): boolean {
  return password.length >= 10 && PASSWORD_PATTERN.test(password);
}

/** Losse eisen, alleen voor de visuele checklist (de echte check blijft isPasswordComplexEnough). */
const REQUIREMENTS: { label: string; test: (pw: string) => boolean }[] = [
  { label: "10+ tekens", test: (pw) => pw.length >= 10 },
  { label: "Hoofdletter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Kleine letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "Cijfer", test: (pw) => /\d/.test(pw) },
];

function ErrorBox({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-loss/30 bg-loss-soft px-3 py-2.5 text-sm text-loss"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useHydrated();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  // Gezet als het account wel is aangemaakt, maar de activatiemail niet
  // verstuurd kon worden (API: emailSent === false).
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendFailed, setResendFailed] = useState(false);
  const [resending, setResending] = useState(false);
  const id = useId();

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const passwordTouched = password.length > 0;
  const passwordValid = isPasswordComplexEnough(password);
  const passwordsMatch = password === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = displayNameSchema.safeParse(displayName);
    if (!name.success) {
      setNameError(name.error.issues[0]?.message ?? "Vul je naam in.");
      return;
    }
    setNameError(null);

    if (!passwordValid) {
      setError("Wachtwoord moet minimaal 10 tekens bevatten, met een hoofdletter, kleine letter en cijfer.");
      return;
    }
    // Geen aparte foutmelding hier: de inline hint onder het
    // bevestigingsveld toont "De wachtwoorden komen niet overeen." al
    // live zodra beide velden zijn ingevuld — een tweede, identieke
    // melding via `error` zou dubbel op het scherm staan.
    if (!passwordsMatch) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<{ message: string; emailSent?: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName: name.data }),
      });
      setEmailWarning(result.emailSent === false ? result.message : null);
      setRegisteredEmail(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!registeredEmail) return;
    setResending(true);
    setResendMessage(null);
    setResendFailed(false);
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/resend-activation", {
        method: "POST",
        body: JSON.stringify({ email: registeredEmail }),
      });
      setResendMessage(result.message);
    } catch {
      setResendFailed(true);
      setResendMessage("Er is iets misgegaan bij het opnieuw versturen.");
    } finally {
      setResending(false);
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout>
        <header className="flex flex-col gap-4">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl",
              emailWarning ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary",
            )}
          >
            {emailWarning ? <MailWarning aria-hidden className="size-7" /> : <MailCheck aria-hidden className="size-7" />}
          </span>
          <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold tracking-tight">Controleer je e-mail</h1>
          {emailWarning ? (
            <div
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning"
            >
              {emailWarning}
            </div>
          ) : (
            <p className="text-muted-foreground">
              We hebben een activatielink gestuurd naar{" "}
              <strong className="font-semibold break-all text-foreground">{registeredEmail}</strong>. Klik op de link om
              je account te activeren; daarna kun je inloggen.
            </p>
          )}
        </header>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">
            {emailWarning
              ? "Vraag hieronder een nieuwe activatielink aan."
              : "Geen e-mail gekregen? Kijk in je spammap of vraag een nieuwe link aan."}
          </p>
          <Button type="button" variant="outline" disabled={resending} onClick={handleResend} className="w-full">
            {resending ? (
              <>
                <Loader2 aria-hidden className="animate-spin" />
                Bezig…
              </>
            ) : (
              "Activatielink opnieuw versturen"
            )}
          </Button>
          <p aria-live="polite" className={cn("text-sm empty:hidden", resendFailed ? "text-loss" : "text-foreground")}>
            {resendMessage}
          </p>
        </div>

        <Button asChild size="lg" className="w-full no-underline">
          <Link href="/login">Naar inloggen</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold tracking-tight">Account aanmaken</h1>
        <p className="text-muted-foreground">
          Heb je al een account?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Inloggen
          </Link>
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Je naam</Label>
          <Input
            id={`${id}-name`}
            type="text"
            name="name"
            autoComplete="name"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (nameError) setNameError(null);
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={`${id}-name-hint`}
            placeholder="Bijv. Sanne de Vries"
          />
          <p id={`${id}-name-hint`} className={cn("text-xs", nameError ? "text-loss" : "text-muted-foreground")}>
            {nameError ?? "Zo zien andere spelers je. Je e-mailadres blijft privé."}
          </p>
        </div>

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
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-password`}>Wachtwoord</Label>
          <PasswordInput
            id={`${id}-password`}
            name="new-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={`${id}-password-hint`}
            aria-invalid={passwordTouched && !passwordValid && error ? true : undefined}
          />
          <p
            id={`${id}-password-hint`}
            className={cn("text-xs", passwordTouched && !passwordValid ? "text-loss" : "text-muted-foreground")}
          >
            Minimaal 10 tekens, met een hoofdletter, kleine letter en een cijfer.
          </p>
          <ul aria-hidden className="flex flex-wrap gap-1.5">
            {REQUIREMENTS.map((req) => {
              const met = req.test(password);
              return (
                <li
                  key={req.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                    met ? "bg-win-soft text-win" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Check className={cn("size-3", met ? "opacity-100" : "opacity-30")} strokeWidth={3} />
                  {req.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-confirm`}>Wachtwoord bevestigen</Label>
          <PasswordInput
            id={`${id}-confirm`}
            name="confirm-password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={showMismatch ? true : undefined}
            aria-describedby={showMismatch ? `${id}-mismatch` : undefined}
          />
          {showMismatch ? (
            <p id={`${id}-mismatch`} className="text-xs text-loss">
              De wachtwoorden komen niet overeen.
            </p>
          ) : null}
        </div>

        {error ? <ErrorBox>{error}</ErrorBox> : null}

        <Button type="submit" size="lg" disabled={submitting || !hydrated} className="mt-1 w-full">
          {submitting ? (
            <>
              <Loader2 aria-hidden className="animate-spin" />
              Bezig…
            </>
          ) : (
            "Account aanmaken"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Na het aanmaken krijg je een e-mail met een activatielink. Daarna kun je inloggen en een duo vormen.
        </p>
      </form>
    </AuthLayout>
  );
}
