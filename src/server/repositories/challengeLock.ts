import { Prisma } from "@prisma/client";

/**
 * `SELECT ... FOR UPDATE` op de challenge-rij. Gedeeld door alle
 * schrijfacties die elkaar per challenge moeten uitsluiten: score-indiening
 * (matchService.submitScore), de unplayed-timeout-job
 * (matchService.expireOneUnplayedChallenge) en uitstel aanvragen/
 * accepteren (postponementService). Zo kan een challenge nooit tegelijk
 * een nieuwe match of verlengde deadline krijgen én op unplayed_timeout
 * gaan (zie ELO_Algoritme.md §5: transactioneel en idempotent).
 */
export async function lockChallengeRow(tx: Prisma.TransactionClient, challengeId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "challenge" WHERE id = ${challengeId}::uuid FOR UPDATE`;
}
