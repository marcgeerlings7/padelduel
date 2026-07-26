import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  signActivationToken,
  verifyActivationToken,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/tokens";

describe("activation tokens", () => {
  it("signt en verifieert een geldig activatietoken", async () => {
    const token = await signActivationToken("user-123");
    const result = await verifyActivationToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe("user-123");
      expect(result.payload.purpose).toBe("activate");
    }
  });

  it("wijst een ongeldig/geknoeid token af", async () => {
    const result = await verifyActivationToken("dit-is-geen-geldig-jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("herkent een verlopen token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await signActivationToken("user-123");
    vi.setSystemTime(new Date("2026-01-03T00:00:00Z")); // > 24h later
    const result = await verifyActivationToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
    vi.useRealTimers();
  });
});

describe("session tokens", () => {
  it("signt en verifieert een geldig sessietoken met rol", async () => {
    const token = await signSessionToken("user-456", "ADMIN");
    const result = await verifySessionToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe("user-456");
      expect(result.payload.role).toBe("ADMIN");
    }
  });

  it("wijst een ongeldig sessietoken af", async () => {
    const result = await verifySessionToken("niet.een.jwt");
    expect(result.ok).toBe(false);
  });
});
