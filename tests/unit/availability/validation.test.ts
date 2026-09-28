import { describe, it, expect } from "vitest";
import {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  availabilityIdSchema,
  validateAvailabilityInput,
} from "@/lib/availability/validation";

const VALID = { dayOfWeek: 1, startTime: "19:30", endTime: "21:15", recurring: false };

describe("availability-validatie (US-H1/H2: vrije tijden)", () => {
  it("accepteert een vrij tijdsblok met willekeurige minuten en recurring-vlag", () => {
    expect(createAvailabilitySchema.safeParse(VALID).success).toBe(true);
    expect(validateAvailabilityInput(VALID)).toBeNull();
  });

  it("zet recurring standaard op true", () => {
    const parsed = createAvailabilitySchema.parse({ dayOfWeek: 0, startTime: "08:00", endTime: "09:00" });
    expect(parsed.recurring).toBe(true);
  });

  it("weigert een eindtijd die niet na de begintijd ligt", () => {
    expect(validateAvailabilityInput({ ...VALID, startTime: "21:00", endTime: "21:00" })).toBe(
      "De eindtijd moet na de begintijd liggen.",
    );
    expect(validateAvailabilityInput({ ...VALID, startTime: "22:00", endTime: "08:00" })).toBe(
      "De eindtijd moet na de begintijd liggen.",
    );
  });

  it("weigert een ongeldig tijdformaat", () => {
    expect(validateAvailabilityInput({ ...VALID, startTime: "7:00" })).toBe("Vul een geldige tijd in (UU:MM).");
    expect(validateAvailabilityInput({ ...VALID, endTime: "24:00" })).toBe("Vul een geldige tijd in (UU:MM).");
  });

  it("weigert een ongeldige dag", () => {
    expect(validateAvailabilityInput({ ...VALID, dayOfWeek: 7 })).toBe("Kies een geldige dag.");
  });

  it("gebruikt voor bewerken dezelfde regels als voor aanmaken", () => {
    expect(updateAvailabilitySchema.safeParse({ ...VALID, endTime: "19:00" }).success).toBe(false);
    expect(updateAvailabilitySchema.safeParse(VALID).success).toBe(true);
  });

  it("valideert het blok-id als UUID", () => {
    expect(availabilityIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success).toBe(true);
    expect(availabilityIdSchema.safeParse("geen-uuid").success).toBe(false);
  });
});
