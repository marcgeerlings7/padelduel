import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/auth/validation";

describe("registerSchema", () => {
  it("accepteert een geldige registratie", () => {
    const result = registerSchema.safeParse({
      email: "Test@Example.com",
      password: "Wachtwoord1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("weigert een ongeldig e-mailadres", () => {
    const result = registerSchema.safeParse({ email: "geen-email", password: "Wachtwoord1" });
    expect(result.success).toBe(false);
  });

  it("weigert een te simpel wachtwoord", () => {
    const result = registerSchema.safeParse({ email: "test@example.com", password: "simpel" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepteert e-mail + niet-leeg wachtwoord", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("weigert een leeg wachtwoord", () => {
    const result = loginSchema.safeParse({ email: "test@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
