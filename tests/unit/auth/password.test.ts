import { describe, it, expect } from "vitest";
import {
  isPasswordComplexEnough,
  hashPassword,
  verifyPassword,
  DUMMY_PASSWORD_HASH,
} from "@/lib/auth/password";

describe("isPasswordComplexEnough", () => {
  it("accepteert een wachtwoord met hoofdletter, kleine letter, cijfer en 10+ tekens", () => {
    expect(isPasswordComplexEnough("Wachtwoord1")).toBe(true);
  });

  it("weigert een te kort wachtwoord", () => {
    expect(isPasswordComplexEnough("Aa1aaaaa")).toBe(false);
  });

  it("weigert een wachtwoord zonder hoofdletter", () => {
    expect(isPasswordComplexEnough("wachtwoord1")).toBe(false);
  });

  it("weigert een wachtwoord zonder cijfer", () => {
    expect(isPasswordComplexEnough("Wachtwoordje")).toBe(false);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("slaat het wachtwoord nooit als plaintext op", async () => {
    const hash = await hashPassword("Wachtwoord1");
    expect(hash).not.toBe("Wachtwoord1");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifieert een correct wachtwoord tegen zijn hash", async () => {
    const hash = await hashPassword("Wachtwoord1");
    await expect(verifyPassword("Wachtwoord1", hash)).resolves.toBe(true);
  });

  it("wijst een fout wachtwoord af", async () => {
    const hash = await hashPassword("Wachtwoord1");
    await expect(verifyPassword("VerkeerdWachtwoord1", hash)).resolves.toBe(false);
  });

  it("DUMMY_PASSWORD_HASH is een geldige bcrypt-hash (voor timing-safety)", async () => {
    await expect(verifyPassword("iets", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
