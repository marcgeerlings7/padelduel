import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  __clearRateLimitStoreForTests,
} from "@/lib/auth/rateLimit";

describe("rate limiter", () => {
  beforeEach(() => {
    __clearRateLimitStoreForTests();
    vi.useRealTimers();
  });

  it("laat toe zolang het maximum niet bereikt is", () => {
    recordFailedAttempt("key1", 3, 15);
    recordFailedAttempt("key1", 3, 15);
    expect(checkRateLimit("key1")).toEqual({ limited: false });
  });

  it("blokkeert zodra het maximum aantal mislukte pogingen bereikt is", () => {
    recordFailedAttempt("key2", 3, 15);
    recordFailedAttempt("key2", 3, 15);
    recordFailedAttempt("key2", 3, 15);
    const status = checkRateLimit("key2");
    expect(status.limited).toBe(true);
  });

  it("laat de blokkade verlopen na de lockout-periode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    recordFailedAttempt("key3", 1, 15);
    expect(checkRateLimit("key3").limited).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:16:00Z")); // 16 min later
    expect(checkRateLimit("key3").limited).toBe(false);
  });

  it("reset de teller bij een succesvolle poging", () => {
    recordFailedAttempt("key4", 2, 15);
    resetRateLimit("key4");
    recordFailedAttempt("key4", 2, 15);
    expect(checkRateLimit("key4").limited).toBe(false);
  });

  it("houdt tellers per key onafhankelijk bij", () => {
    recordFailedAttempt("key5", 1, 15);
    expect(checkRateLimit("key5").limited).toBe(true);
    expect(checkRateLimit("key6").limited).toBe(false);
  });
});
