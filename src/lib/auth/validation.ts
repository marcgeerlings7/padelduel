import { z } from "zod";
import { isPasswordComplexEnough } from "./password";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().refine(isPasswordComplexEnough, {
    message:
      "Wachtwoord moet minimaal 10 tekens bevatten, met een hoofdletter, kleine letter en cijfer.",
  }),
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
