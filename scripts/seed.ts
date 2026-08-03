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
const START_RATINGS = [1450, 1380, 1320, 1280, 1240, 1200, 1160, 1120, 1080, 1020];

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

  console.log(`Seed klaar: 1 regio, 20 users, 1 admin, ${duoIds.length} actieve duo's.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
