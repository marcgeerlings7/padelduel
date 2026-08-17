import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError("Niet ingelogd.", 401, "unauthorized");
  }

  const rows = await prisma.ratingHistory.findMany({
    where: { duoId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      match: { include: { challenge: { include: { challengerDuo: true, challengedDuo: true } } } },
      challenge: { include: { challengerDuo: true, challengedDuo: true } },
    },
  });

  const history = rows.map((row) => {
    const challenge = row.match?.challenge ?? row.challenge;
    const opponent =
      challenge?.challengerDuoId === params.id ? challenge?.challengedDuo : challenge?.challengerDuo;
    return {
      id: row.id,
      ratingBefore: row.ratingBefore,
      ratingAfter: row.ratingAfter,
      kFactor: row.kFactor,
      isForfeit: row.isForfeit,
      matchId: row.matchId,
      challengeId: row.challengeId,
      createdAt: row.createdAt,
      opponentName: opponent?.name ?? null,
    };
  });

  return NextResponse.json(history);
}
