const TOKEN_KEY = "padel_ladder_session_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Leest de rol uit het (ongeverifieerde) JWT-payload, puur voor UI-hints
 * zoals het wel/niet tonen van een "Admin"-link. De daadwerkelijke
 * autorisatie gebeurt altijd server-side (getCurrentUser + rolcheck) —
 * dit is nooit een security-grens.
 */
export function getStoredRole(): "USER" | "ADMIN" | null {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const payloadBase64 = token.split(".")[1];
    const payload = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "ADMIN" ? "ADMIN" : "USER";
  } catch {
    return null;
  }
}
