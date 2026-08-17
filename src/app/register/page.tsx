"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken } from "@/lib/client/session";
import { AuthLayout } from "@/components/auth/AuthLayout";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

function isPasswordComplexEnough(password: string): boolean {
  return password.length >= 10 && PASSWORD_PATTERN.test(password);
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const passwordTouched = password.length > 0;
  const passwordValid = isPasswordComplexEnough(password);
  const passwordsMatch = password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

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
      await apiFetch<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
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
    try {
      const result = await apiFetch<{ message: string }>("/api/auth/resend-activation", {
        method: "POST",
        body: JSON.stringify({ email: registeredEmail }),
      });
      setResendMessage(result.message);
    } catch {
      setResendMessage("Er is iets misgegaan bij het opnieuw versturen.");
    } finally {
      setResending(false);
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout>
        <div className="tag tag-accent" style={{ marginBottom: 10 }}>
          Bijna klaar
        </div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: "0 0 12px" }}>
          Controleer je e-mail
        </h1>
        <p style={{ margin: "0 0 8px", color: "var(--color-neutral-700)", fontSize: 14, lineHeight: 1.6 }}>
          We hebben een activatielink gestuurd naar <strong>{registeredEmail}</strong>. Klik op de link
          om je account te activeren — daarna kun je inloggen.
        </p>
        <p style={{ margin: "0 0 24px", color: "var(--color-neutral-600)", fontSize: 13 }}>
          Geen e-mail gekregen? Controleer je spam-map, of vraag hieronder een nieuwe link aan.
        </p>
        <button type="button" disabled={resending} onClick={handleResend} className="btn btn-secondary">
          {resending ? "Bezig..." : "Activatielink opnieuw versturen"}
        </button>
        {resendMessage && (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text)" }}>{resendMessage}</p>
        )}
        <div className="hr" style={{ margin: "28px 0" }} />
        <Link href="/login" className="btn btn-primary btn-block">
          Naar inloggen
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: "0 0 8px" }}>
        Account aanmaken
      </h1>
      <p style={{ margin: "0 0 28px", color: "var(--color-neutral-700)", fontSize: 14 }}>
        Heb je al een account? <Link href="/login">Inloggen</Link>.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>E-mailadres</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jij@padel.nl"
          />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Wachtwoord</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </div>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 12,
            color: passwordTouched && !passwordValid ? "var(--color-accent-700)" : "var(--color-neutral-600)",
          }}
        >
          Minimaal 10 tekens, met een hoofdletter, kleine letter en een cijfer.
        </p>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Wachtwoord bevestigen</label>
          <input
            className="input"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••"
          />
        </div>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--color-accent-700)" }}>
            De wachtwoorden komen niet overeen.
          </p>
        )}
        {error && (
          <p style={{ color: "var(--color-accent-700)", fontSize: 13, marginTop: 8, marginBottom: 16 }}>{error}</p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          {submitting ? "Bezig..." : "Account aanmaken"}
        </button>
      </form>

      <div className="hr" style={{ margin: "28px 0" }} />
      <div className="flex flex-wrap gap-2">
        <span className="tag tag-neutral">Multi-duo ondersteund</span>
        <span className="tag tag-outline">ELO-rating</span>
      </div>
    </AuthLayout>
  );
}
