/**
 * Gesorteerde concatenatie van twee user-id's, gebruikt als
 * Duo.memberPairKey en DuoInvitation.invitationPairKey (zie
 * Database_Schema.sql-opmerkingen bij de duo-tabel).
 */
export function buildPairKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("::");
}
