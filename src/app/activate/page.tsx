"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/client/api";
import { AuthLayout } from "@/components/auth/AuthLayout";

type Status = "activating" | "success" | "error";

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
    <AuthLayout>
      <div className={`tag ${status === "error" ? "tag-accent" : "tag-neutral"}`} style={{ marginBottom: 10 }}>
        Account activeren
      </div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, margin: "0 0 12px" }}>
        {status === "activating" && "Bezig met activeren..."}
        {status === "success" && "Account geactiveerd"}
        {status === "error" && "Activeren mislukt"}
      </h1>
      {message && (
        <p style={{ margin: "0 0 24px", color: "var(--color-neutral-700)", fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </p>
      )}
      {status === "success" && (
        <Link href="/login" className="btn btn-primary btn-block">
          Naar inloggen
        </Link>
      )}
      {status === "error" && (
        <Link href="/register" className="btn btn-secondary btn-block">
          Nieuw account aanmaken
        </Link>
      )}
    </AuthLayout>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateContent />
    </Suspense>
  );
}
