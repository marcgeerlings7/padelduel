import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndRecordRequest, __clearApiRateLimitStoreForTests } from "@/lib/apiClient/rateLimit";

describe("checkAndRecordRequest", () => {
  beforeEach(() => {
    __clearApiRateLimitStoreForTests();
    vi.useRealTimers();
  });

  it("laat aanroepen toe zolang het maximum binnen het venster niet bereikt is", () => {
    expect(checkAndRecordRequest("client-1", 3, 60_000).limited).toBe(false);
    expect(checkAndRecordRequest("client-1", 3, 60_000).limited).toBe(false);
    expect(checkAndRecordRequest("client-1", 3, 60_000).limited).toBe(false);
  });

  it("blokkeert zodra het maximum binnen het venster overschreden wordt", () => {
    checkAndRecordRequest("client-2", 2, 60_000);
    checkAndRecordRequest("client-2", 2, 60_000);
    const result = checkAndRecordRequest("client-2", 2, 60_000);
    expect(result.limited).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reset na afloop van het venster", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    checkAndRecordRequest("client-3", 1, 60_000);
    expect(checkAndRecordRequest("client-3", 1, 60_000).limited).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z")); // net na het venster
    expect(checkAndRecordRequest("client-3", 1, 60_000).limited).toBe(false);
  });

  it("houdt tellers per key onafhankelijk bij", () => {
    checkAndRecordRequest("client-4", 1, 60_000);
    expect(checkAndRecordRequest("client-4", 1, 60_000).limited).toBe(true);
    expect(checkAndRecordRequest("client-5", 1, 60_000).limited).toBe(false);
  });
});
