import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/password";
import {
  signActivationToken,
  verifyActivationToken,
  signSessionToken,
} from "@/lib/auth/tokens";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/auth/rateLimit";
import { sendEmail, buildActivationEmail } from "@/lib/auth/email";
import { getConfigNumber } from "@/server/repositories/platformConfigRepository";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

const GENERIC_REGISTER_ERROR =
  "Er kon geen account worden aangemaakt met deze gegevens.";
const GENERIC_LOGIN_ERROR = "Ongeldige combinatie van e-mailadres en wachtwoord.";
const GENERIC_RESEND_MESSAGE =
  "Als dit e-mailadres bij ons bekend is en nog niet is geactiveerd, ontvang je een nieuwe activatielink.";

function buildActivationUrl(token: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/activate?token=${encodeURIComponent(token)}`;
}

export async function register(email: string, password: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Generieke melding (US-A1): onthult niet of het account al bestaat.
    throw new AuthError(GENERIC_REGISTER_ERROR, "registration_failed", 400);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, isActive: false },
  });

  const token = await signActivationToken(user.id);
  await sendEmail(buildActivationEmail(email, buildActivationUrl(token)));
}

export async function activate(token: string): Promise<void> {
  const result = await verifyActivationToken(token);
  if (!result.ok) {
    throw new AuthError(
      "Deze activatielink is ongeldig of verlopen. Vraag een nieuwe aan.",
      result.reason === "expired" ? "activation_expired" : "activation_invalid",
      400,
    );
  }

  const user = await prisma.user.findUnique({ where: { id: result.payload.sub } });
  if (!user) {
    throw new AuthError(
      "Deze activatielink is ongeldig of verlopen. Vraag een nieuwe aan.",
      "activation_invalid",
      400,
    );
  }

  if (user.isActive) {
    throw new AuthError(
      "Deze activatielink is al gebruikt. Je account is al actief — je kunt inloggen.",
      "activation_already_used",
      400,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isActive: true, activatedAt: new Date() },
  });
}

export async function resendActivation(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.isActive) {
    const token = await signActivationToken(user.id);
    await sendEmail(buildActivationEmail(email, buildActivationUrl(token)));
  }
  // Generiek antwoord, ongeacht of het e-mailadres bestaat of al actief is.
  return GENERIC_RESEND_MESSAGE;
}

export type LoginResult = { token: string };

export async function login(
  email: string,
  password: string,
  rateLimitKey: string,
): Promise<LoginResult> {
  const maxAttempts = await getConfigNumber("login_max_attempts");
  const lockoutMinutes = await getConfigNumber("login_lockout_minutes");

  const status = checkRateLimit(rateLimitKey);
  if (status.limited) {
    throw new AuthError(
      "Te veel mislukte inlogpogingen. Probeer het later opnieuw.",
      "rate_limited",
      429,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Vergelijk altijd tegen een hash (ook als de user niet bestaat) zodat
  // de responstijd niet verraadt of het e-mailadres geregistreerd is.
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches) {
    recordFailedAttempt(rateLimitKey, maxAttempts, lockoutMinutes);
    throw new AuthError(GENERIC_LOGIN_ERROR, "invalid_credentials", 401);
  }

  if (!user.isActive) {
    // Correcte combinatie, maar account nog niet geactiveerd: dit telt
    // niet als een mislukte poging (het wachtwoord was immers correct).
    throw new AuthError(
      "Je account is nog niet geactiveerd. Controleer je e-mail voor de activatielink.",
      "account_not_active",
      403,
    );
  }

  resetRateLimit(rateLimitKey);
  const token = await signSessionToken(user.id, user.role);
  return { token };
}
