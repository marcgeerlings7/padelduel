import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/apiClient/apiKey";

describe("generateApiKey", () => {
  it("genereert een key met een herkenbaar prefix", () => {
    const { plaintextKey } = generateApiKey();
    expect(plaintextKey.startsWith("padel_live_")).toBe(true);
  });

  it("genereert elke keer een andere key", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintextKey).not.toBe(b.plaintextKey);
  });

  it("de hash komt overeen met hashApiKey op dezelfde plaintext", () => {
    const { plaintextKey, keyHash } = generateApiKey();
    expect(hashApiKey(plaintextKey)).toBe(keyHash);
  });

  it("hashApiKey is deterministisch en niet gelijk aan de plaintext", () => {
    const hash1 = hashApiKey("test-key");
    const hash2 = hashApiKey("test-key");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe("test-key");
  });
});
