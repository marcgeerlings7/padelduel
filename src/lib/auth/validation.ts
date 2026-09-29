import { z } from "zod";
import { isPasswordComplexEnough } from "./password";
import { displayNameSchema } from "@/lib/profile/validation";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().refine(isPasswordComplexEnough, {
    message:
      "Wachtwoord moet minimaal 10 tekens bevatten, met een hoofdletter, kleine letter en cijfer.",
  }),
  // KNLTB-aanvullingen: weergavenaam bij registratie. Tijdelijk optioneel
  // in de API zodat de huidige registratiepagina (die het veld nog niet
  // meestuurt) blijft werken; het nieuwe registratieformulier hoort het
  // verplicht te maken. Wordt het wel meegestuurd, dan geldt de volledige
  // validatie. Zonder naam toont de app een neutrale fallback en vraagt
  // /api/me/profile (hasDisplayName: false) de UI om een naam.
  displayName: displayNameSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const activateSchema = z.object({
  token: z.string().min(1),
});

export const resendActivationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
