/**
 * Spelersprofiel (KNLTB-aanvullingen, akkoord PO 2026-09-28). Alleen voor
 * de ingelogde gebruiker zelf; andere gebruikers zien uitsluitend de
 * publieke weergavenaam (publicDisplayName), nooit het e-mailadres of de
 * speelsterkte. Niets hiervan gaat via de externe availability-API.
 */
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
  /** Zelf opgegeven KNLTB-speelsterkte 1-9 (niet geverifieerd), of null. */
  knltbLevel: number | null;
  knltbLevelIsSelfDeclared: true;
};

type UserRow = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  displayName: string | null;
  knltbLevel: number | null;
};

function toProfile(user: UserRow): MyProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    publicName: publicDisplayName(user),
    hasDisplayName: !!user.displayName,
    knltbLevel: user.knltbLevel,
    knltbLevelIsSelfDeclared: true,
  };
}

const PROFILE_SELECT = { id: true, email: true, role: true, displayName: true, knltbLevel: true } as const;

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
  if (!user) {
    throw new ProfileError("Gebruiker niet gevonden.", "user_not_found", 404);
  }
  return toProfile(user);
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput): Promise<MyProfile> {
  const data: { displayName?: string; knltbLevel?: number | null } = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.knltbLevel !== undefined) data.knltbLevel = input.knltbLevel;

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) {
    throw new ProfileError("Gebruiker niet gevonden.", "user_not_found", 404);
  }
  const user = await prisma.user.update({ where: { id: userId }, data, select: PROFILE_SELECT });
  return toProfile(user);
}
