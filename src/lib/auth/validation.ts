import { z } from "zod";
import { isPasswordComplexEnough } from "./password";
import { displayNameSchema } from "@/lib/profile/validation";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().refine(isPasswordComplexEnough, {
    message:
      "Wachtwoord moet minimaal 10 tekens bevatten, met een hoofdletter, kleine letter en cijfer.",
  }),
  // KNLTB-aanvullingen: weergavenaam bij registratie is verplicht (de
  // registratiepagina vraagt hem). Bestaande accounts zonder naam krijgen
  // een neutrale fallback en worden via /api/me/profile
  // (hasDisplayName: false) gevraagd er alsnog een in te stellen.
  displayName: displayNameSchema,
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
