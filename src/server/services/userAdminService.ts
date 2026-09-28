import { prisma } from "@/lib/prisma";

export class UserAdminError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
  }
}

export type UserRoleValue = "USER" | "ADMIN";

export type AdminUserSummary = {
  id: string;
  email: string;
  role: UserRoleValue;
  isActive: boolean;
  createdAt: Date;
  activeDuoCount: number;
};

/** Harde bovengrens op het aantal rijen in het overzicht (pilotschaal). */
export const ADMIN_USER_LIST_LIMIT = 200;

/**
 * Advisory-lock-sleutel voor rolwijzigingen: serialiseert gelijktijdige
 * promoties/degradaties, zodat twee admins die elkaar tegelijk degraderen
 * nooit samen de laatste admin kunnen wegnemen.
 */
const ROLE_CHANGE_LOCK_NAME = "app_user_role_change";

export async function listUsers(query?: string): Promise<AdminUserSummary[]> {
  const trimmed = query?.trim();
  const users = await prisma.user.findMany({
    where: trimmed ? { email: { contains: trimmed, mode: "insensitive" } } : undefined,
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { memberships: { where: { leftAt: null } } } },
    },
    // Admins bovenaan, daarna alfabetisch.
    orderBy: [{ role: "desc" }, { email: "asc" }],
    take: ADMIN_USER_LIST_LIMIT,
  });

  return users.map(({ _count, ...user }) => ({ ...user, activeDuoCount: _count.memberships }));
}

export type RoleChangeResult = { changed: boolean; role: UserRoleValue };

/**
 * Promoveert/degradeert een gebruiker (post-v1, akkoord PO 2026-09-28).
 *
 * Regels:
 * - Alleen geactiveerde accounts kunnen admin worden.
 * - De laatste actieve admin kan nooit gedegradeerd worden (ook niet door
 *   zichzelf) — anders is er niemand meer die disputes/API-clients/rollen
 *   kan beheren, en is herstel alleen nog via de database mogelijk.
 * - Elke daadwerkelijke wijziging krijgt een audit_log-rij
 *   (entity_type 'app_user', action 'user_role_changed').
 * - Dezelfde rol nogmaals zetten is een no-op (geen audit-rij).
 */
export async function setUserRole(
  targetUserId: string,
  newRole: UserRoleValue,
  actingAdminId: string,
): Promise<RoleChangeResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ROLE_CHANGE_LOCK_NAME}))`;

    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      throw new UserAdminError("Gebruiker niet gevonden.", "user_not_found", 404);
    }
    if (target.role === newRole) {
      return { changed: false, role: target.role };
    }

    if (newRole === "ADMIN" && !target.isActive) {
      throw new UserAdminError(
        "Alleen geactiveerde accounts kunnen admin worden.",
        "user_not_active",
        400,
      );
    }

    if (newRole === "USER") {
      const otherActiveAdmins = await tx.user.count({
        where: { role: "ADMIN", isActive: true, id: { not: targetUserId } },
      });
      if (otherActiveAdmins === 0) {
        throw new UserAdminError(
          targetUserId === actingAdminId
            ? "Je bent de laatste admin — wijs eerst een andere admin aan voordat je je eigen rechten intrekt."
            : "Dit is de laatste admin; de admin-rol kan niet worden ingetrokken.",
          "last_admin",
          409,
        );
      }
    }

    await tx.user.update({ where: { id: targetUserId }, data: { role: newRole } });
    await tx.auditLog.create({
      data: {
        entityType: "app_user",
        entityId: targetUserId,
        action: "user_role_changed",
        performedBy: actingAdminId,
        payload: { from: target.role, to: newRole },
      },
    });

    return { changed: true, role: newRole };
  });
}
