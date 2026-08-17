/**
 * Seed-script conform US-D2 (docs/Sprint1_User_Stories.md, Epic D).
 * Herhaalbaar (idempotent) op een lege/dev-database: upsert op vaste,
 * deterministische UUID's i.p.v. gen_random_uuid(), zodat een tweede
 * run geen duplicaten oplevert.
 *
 * Maakt: 1 regio, 20 gebruikers, 10 actieve duo's met variërende, vaste
 * startratings (niet via matches berekend). Vier gebruikers (1, 3, 5, 7)
 * zitten bewust in twee duo's tegelijk, zodat multi-duo-gedrag (FR-1.4)
 * vanaf het begin zichtbaar is.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function seedId(category: number, index: number): string {
  const last = `${category}${index.toString().padStart(11, "0")}`;
  return `00000000-0000-4000-8000-${last}`;
}

const REGION_ID = seedId(0, 1);
const userId = (n: number) => seedId(1, n);
const duoId = (n: number) => seedId(2, n);
const ADMIN_ID = seedId(3, 1);
const challengeId = (n: number) => seedId(4, n);
const matchId = (n: number) => seedId(5, n);
const disputeId = (n: number) => seedId(6, n);
const invitationId = (n: number) => seedId(7, n);

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS);
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY_MS);

const DUO_NAMES = [
  "Smash Sisters",
  "Net Ninjas",
  "Baseline Bandits",
  "Volley Vikings",
  "Ace Avengers",
  "Drop Shot Dynamo",
  "Bandeja Boys",
  "Vibora Vipers",
  "Chiquita Chargers",
  "Global Gladiators",
];

// Bewust variërend, aflopend, zodat de ladder-sortering (US-C1) en
// latere tier-indeling (Sprint 2, tier_size=100) meteen te testen zijn.
// Smash Sisters staat op 1395 (niet 1450) i.p.v. een ronde waarde, zodat
// het duo binnen tier 13 valt samen met Net Ninjas/Baseline Bandits —
// anders staat het in zijn eentje in tier 14 en is er nergens een duo
// om uit te dagen (de eerst zichtbare acting-duo op de ladder/dashboard
// zou dan zonder uitleg "niets te klikken" lijken te hebben).
const START_RATINGS = [1395, 1380, 1320, 1280, 1240, 1200, 1160, 1120, 1080, 1020];

// [challengerIndex, challengedIndex] user-nummers (1-20) per duo.
// Duo's 9 en 10 hergebruiken users 1, 3, 5, 7 om multi-duo-lidmaatschap
// te demonstreren (nooit hetzelfde koppel tweemaal, conform FR-2.3).
const DUO_MEMBERS: [number, number][] = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [1, 3],
  [5, 7],
];

function memberPairKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("::");
}

async function main() {
  const passwordHash = await bcrypt.hash("PadelTest123!", 10);

  const region = await prisma.region.upsert({
    where: { id: REGION_ID },
    update: { name: "Utrecht", slug: "utrecht" },
    create: { id: REGION_ID, name: "Utrecht", slug: "utrecht" },
  });

  for (let n = 1; n <= 20; n++) {
    await prisma.user.upsert({
      where: { id: userId(n) },
      update: {},
      create: {
        id: userId(n),
        email: `user${n}@example.com`,
        passwordHash,
        role: "USER",
        isActive: true,
        activatedAt: new Date(),
      },
    });
  }

  // Admin-account (Epic G, Sprint 4) — nodig om de admin-disputeflows te
  // kunnen testen/demonstreren; geen onderdeel van de reguliere 20 spelers.
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
      isActive: true,
      activatedAt: new Date(),
    },
  });

  const duoIds: string[] = [];
  for (let i = 0; i < DUO_MEMBERS.length; i++) {
    const id = duoId(i + 1);
    const [a, b] = DUO_MEMBERS[i];
    await prisma.duo.upsert({
      where: { id },
      update: {
        name: DUO_NAMES[i],
        regionId: region.id,
        memberPairKey: memberPairKey(userId(a), userId(b)),
        isActive: true,
        currentRating: START_RATINGS[i],
      },
      create: {
        id,
        name: DUO_NAMES[i],
        regionId: region.id,
        memberPairKey: memberPairKey(userId(a), userId(b)),
        isActive: true,
        currentRating: START_RATINGS[i],
      },
    });
    duoIds.push(id);
  }

  // Idempotentie voor memberships: geen natuurlijke unique key op
  // (user_id, duo_id), dus verwijder en herschep de memberships van
  // exact deze seed-duo's per run.
  await prisma.duoMembership.deleteMany({ where: { duoId: { in: duoIds } } });
  for (let i = 0; i < DUO_MEMBERS.length; i++) {
    const [a, b] = DUO_MEMBERS[i];
    await prisma.duoMembership.create({
      data: { userId: userId(a), duoId: duoId(i + 1) },
    });
    await prisma.duoMembership.create({
      data: { userId: userId(b), duoId: duoId(i + 1) },
    });
  }

  // ---------------------------------------------------------------------
  // Demo-scenario's rond user1@example.com (lid van Smash Sisters/duo1 en
  // Chiquita Chargers/duo9), zodat een nieuwe/demo-omgeving niet leeg
  // oogt: een historische wedstrijd (rating-historie), een lopend
  // geschil, en openstaande challenges/duo-uitnodiging om te kunnen
  // testen zonder eerst zelf een hele flow te doorlopen.
  // ---------------------------------------------------------------------

  // 1) Historisch: Smash Sisters (duo1) wint van Net Ninjas (duo2).
  //    ratingAfter komt overeen met de huidige current_rating van beide
  //    duo's, zodat rating-historie en ladder niet tegenstrijdig ogen.
  await prisma.challenge.upsert({
    where: { id: challengeId(1) },
    update: {},
    create: {
      id: challengeId(1),
      challengerDuoId: duoId(1),
      challengedDuoId: duoId(2),
      status: "COMPLETED",
      createdAt: daysAgo(10),
      responseDeadline: daysAgo(8),
      respondedAt: daysAgo(9),
      acceptedAt: daysAgo(9),
      matchDeadline: daysAgo(7),
    },
  });
  await prisma.match.upsert({
    where: { id: matchId(1) },
    update: {},
    create: {
      id: matchId(1),
      challengeId: challengeId(1),
      scoreRaw: "6-4, 6-3",
      status: "COMPLETED",
      submittedBy: userId(1),
      confirmedBy: userId(3),
      submittedAt: daysAgo(7),
      confirmedAt: daysAgo(7),
      autoConfirmDeadline: daysAgo(5),
    },
  });
  await prisma.ratingHistory.upsert({
    where: { duoId_matchId: { duoId: duoId(1), matchId: matchId(1) } },
    update: {},
    create: {
      duoId: duoId(1),
      matchId: matchId(1),
      ratingBefore: 1365,
      ratingAfter: 1395,
      kFactor: 30,
      isForfeit: false,
      createdAt: daysAgo(7),
    },
  });
  await prisma.ratingHistory.upsert({
    where: { duoId_matchId: { duoId: duoId(2), matchId: matchId(1) } },
    update: {},
    create: {
      duoId: duoId(2),
      matchId: matchId(1),
      ratingBefore: 1410,
      ratingAfter: 1380,
      kFactor: 30,
      isForfeit: false,
      createdAt: daysAgo(7),
    },
  });

  // 2) Historisch: Chiquita Chargers (duo9) verliest van Baseline Bandits (duo3).
  //    (Bandeja Boys/duo7 en Vibora Vipers/duo8 blijven bewust ongemoeid —
  //    die zijn gereserveerd voor 03-challenge-and-match.spec.ts.)
  await prisma.challenge.upsert({
    where: { id: challengeId(5) },
    update: {},
    create: {
      id: challengeId(5),
      challengerDuoId: duoId(9),
      challengedDuoId: duoId(3),
      status: "COMPLETED",
      createdAt: daysAgo(14),
      responseDeadline: daysAgo(12),
      respondedAt: daysAgo(13),
      acceptedAt: daysAgo(13),
      matchDeadline: daysAgo(11),
    },
  });
  await prisma.match.upsert({
    where: { id: matchId(3) },
    update: {},
    create: {
      id: matchId(3),
      challengeId: challengeId(5),
      scoreRaw: "4-6, 3-6",
      status: "COMPLETED",
      submittedBy: userId(5),
      confirmedBy: userId(1),
      submittedAt: daysAgo(11),
      confirmedAt: daysAgo(11),
      autoConfirmDeadline: daysAgo(9),
    },
  });
  await prisma.ratingHistory.upsert({
    where: { duoId_matchId: { duoId: duoId(9), matchId: matchId(3) } },
    update: {},
    create: {
      duoId: duoId(9),
      matchId: matchId(3),
      ratingBefore: 1110,
      ratingAfter: 1080,
      kFactor: 30,
      isForfeit: false,
      createdAt: daysAgo(11),
    },
  });
  await prisma.ratingHistory.upsert({
    where: { duoId_matchId: { duoId: duoId(3), matchId: matchId(3) } },
    update: {},
    create: {
      duoId: duoId(3),
      matchId: matchId(3),
      ratingBefore: 1290,
      ratingAfter: 1320,
      kFactor: 30,
      isForfeit: false,
      createdAt: daysAgo(11),
    },
  });

  // 3) Openstaande (PENDING) challenges op beide duo's van user1.
  await prisma.challenge.upsert({
    where: { id: challengeId(2) },
    update: {},
    create: {
      id: challengeId(2),
      challengerDuoId: duoId(2), // Net Ninjas daagt Smash Sisters uit
      challengedDuoId: duoId(1),
      status: "PENDING",
      createdAt: daysAgo(2),
      responseDeadline: daysFromNow(5),
    },
  });
  await prisma.challenge.upsert({
    where: { id: challengeId(3) },
    update: {},
    create: {
      id: challengeId(3),
      challengerDuoId: duoId(10), // Global Gladiators daagt Chiquita Chargers uit
      challengedDuoId: duoId(9),
      status: "PENDING",
      createdAt: daysAgo(1),
      responseDeadline: daysFromNow(4),
    },
  });

  // 4) Lopend geschil: Smash Sisters (duo1) vs. Baseline Bandits (duo3),
  //    match staat op DISPUTED met een open MATCH_SCORE-dispute.
  await prisma.challenge.upsert({
    where: { id: challengeId(4) },
    update: {},
    create: {
      id: challengeId(4),
      challengerDuoId: duoId(1),
      challengedDuoId: duoId(3),
      status: "ACCEPTED",
      createdAt: daysAgo(6),
      responseDeadline: daysAgo(4),
      respondedAt: daysAgo(5),
      acceptedAt: daysAgo(5),
      matchDeadline: daysFromNow(2),
    },
  });
  await prisma.match.upsert({
    where: { id: matchId(2) },
    update: {},
    create: {
      id: matchId(2),
      challengeId: challengeId(4),
      scoreRaw: "6-4, 4-6, 6-2",
      status: "DISPUTED",
      submittedBy: userId(1),
      submittedAt: daysAgo(1),
      autoConfirmDeadline: daysFromNow(1),
    },
  });
  await prisma.dispute.upsert({
    where: { id: disputeId(1) },
    update: {},
    create: {
      id: disputeId(1),
      matchId: matchId(2),
      subject: "MATCH_SCORE",
      raisedBy: userId(5),
      reason: "Wij wonnen de tweede set met 6-4, niet met 4-6 zoals ingevoerd.",
      status: "OPEN",
      createdAt: daysAgo(1),
    },
  });

  // 5) Openstaande duo-uitnodiging voor user1 (van een vrije, niet-geseede speler).
  await prisma.duoInvitation.upsert({
    where: { id: invitationId(1) },
    update: {},
    create: {
      id: invitationId(1),
      duoName: "Rally Rebels",
      regionId: region.id,
      proposedByUserId: userId(19),
      invitedUserId: userId(1),
      invitationPairKey: memberPairKey(userId(19), userId(1)),
      status: "PENDING",
      createdAt: daysAgo(1),
    },
  });

  console.log(`Seed klaar: 1 regio, 20 users, 1 admin, ${duoIds.length} actieve duo's.`);
  console.log(
    "Demo-scenario user1@example.com: rating-historie, openstaande challenges, open dispute, openstaande duo-uitnodiging.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
