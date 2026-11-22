/**
 * Spelersprofiel (KNLTB-aanvullingen, akkoord PO 2026-09-28). Alleen voor
 * de ingelogde gebruiker zelf; andere gebruikers zien uitsluitend de
 * publieke weergavenaam (publicDisplayName), nooit het e-mailadres of de
 * speelsterkte. Niets hiervan gaat via de externe availability-API.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicDisplayName } from "@/lib/profile/displayName";
import type { UpdateProfileInput } from "@/lib/profile/validation";

export class ProfileError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export type MyProfile = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  /** Zelf ingestelde weergavenaam, of null als die nog niet is ingesteld. */
  displayName: string | null;
  /** Wat andere spelers zien (weergavenaam of neutrale fallback). */
  publicName: string;
  /** false → de UI moet de gebruiker vragen een naam in te stellen. */
  hasDisplayName: boolean;
  /** Zelf opgegeven KNLTB-speelsterkte 1-9, of null. */
  knltbLevel: number | null;
  /**
   * Verificatie van de speelsterkte door een admin (laag C, akkoord PO
   * 2026-11-22): "none" (zelf opgegeven), "requested" (aangevraagd) of
   * "verified". Een gewijzigde speelsterkte zet dit terug op "none".
   */
  knltbVerification: KnltbVerificationStatus;
};

export type KnltbVerificationStatus = "none" | "requested" | "verified";

type UserRow = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  displayName: string | null;
  knltbLevel: number | null;
  knltbLevelVerifiedAt: Date | null;
  knltbVerificationRequestedAt: Date | null;
};

export function verificationStatus(user: {
  knltbLevelVerifiedAt: Date | null;
  knltbVerificationRequestedAt: Date | null;
}): KnltbVerificationStatus {
  if (user.knltbLevelVerifiedAt) return "verified";
  if (user.knltbVerificationRequestedAt) return "requested";
  return "none";
}

function toProfile(user: UserRow): MyProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    publicName: publicDisplayName(user),
    hasDisplayName: !!user.displayName,
    knltbLevel: user.knltbLevel,
    knltbVerification: verificationStatus(user),
  };
}

const PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  displayName: true,
  knltbLevel: true,
  knltbLevelVerifiedAt: true,
  knltbVerificationRequestedAt: true,
} as const;

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) {
    throw new ProfileError("Gebruiker niet gevonden.", "user_not_found", 404);
  }
  return toProfile(user);
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput): Promise<MyProfile> {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, knltbLevel: true } });
  if (!existing) {
    throw new ProfileError("Gebruiker niet gevonden.", "user_not_found", 404);
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.knltbLevel !== undefined) {
    data.knltbLevel = input.knltbLevel;
    // Een gewijzigde speelsterkte is niet meer de geverifieerde: verificatie
    // en een openstaande aanvraag vervallen (laag C).
    if (input.knltbLevel !== existing.knltbLevel) {
      data.knltbLevelVerifiedAt = null;
      data.knltbLevelVerifiedBy = { disconnect: true };
      data.knltbVerificationRequestedAt = null;
    }
  }

  const user = await prisma.user.update({ where: { id: userId }, data, select: PROFILE_SELECT });
  return toProfile(user);
}

/**
 * Laag C: de speler vraagt verificatie van de opgegeven speelsterkte aan.
 * Een admin vraagt daarna buiten de app (e-mail) om een schermafbeelding van
 * MijnKNLTB; die wordt nergens opgeslagen. Idempotent: een tweede aanvraag
 * laat de oorspronkelijke datum staan.
 */
export async function requestKnltbVerification(userId: string): Promise<MyProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) {
    throw new ProfileError("Gebruiker niet gevonden.", "user_not_found", 404);
  }
  if (user.knltbLevel === null) {
    throw new ProfileError(
      "Vul eerst je KNLTB-speelsterkte in voordat je verificatie aanvraagt.",
      "knltb_level_missing",
      400,
    );
  }
  if (user.knltbLevelVerifiedAt) {
    throw new ProfileError("Je speelsterkte is al geverifieerd.", "already_verified", 409);
  }
  if (user.knltbVerificationRequestedAt) {
    return toProfile(user);
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { knltbVerificationRequestedAt: new Date() },
    select: PROFILE_SELECT,
  });
  return toProfile(updated);
}
