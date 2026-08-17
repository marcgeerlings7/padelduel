"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/client/api";
import { getStoredToken, setStoredToken } from "@/lib/client/session";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: "0 0 8px" }}>
        Inloggen
      </h1>
      <p style={{ margin: "0 0 28px", color: "var(--color-neutral-700)", fontSize: 14 }}>
        Nog geen account? <Link href="/register">Account aanmaken</Link>.
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
        <div className="field" style={{ marginBottom: 24 }}>
          <label>Wachtwoord</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p style={{ color: "var(--color-accent-700)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary btn-block">
          {submitting ? "Bezig..." : "Inloggen"}
        </button>
      </form>

      <div
        className="card"
        style={{ borderRadius: 0, marginTop: 16, padding: "12px 16px", background: "var(--color-neutral-100)" }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-neutral-600)",
          }}
        >
          Testaccount
        </p>
        <p style={{ margin: 0, fontSize: 13 }}>
          user1@example.com / <code>PadelTest123!</code>
        </p>
      </div>

      <div className="hr" style={{ margin: "28px 0" }} />
      <div className="flex flex-wrap gap-2">
        <span className="tag tag-neutral">Multi-duo ondersteund</span>
        <span className="tag tag-outline">ELO-rating</span>
      </div>
    </AuthLayout>
  );
}
