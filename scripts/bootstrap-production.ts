/**
 * Eenmalige, idempotente inrichting van een (productie)database — het
 * tegenovergestelde van scripts/seed.ts: maakt GEEN demo-gebruikers of
 * -duo's aan, alleen wat een lege omgeving minimaal nodig heeft.
 *
 *   npx tsx scripts/bootstrap-production.ts --region "Utrecht"
 *   npx tsx scripts/bootstrap-production.ts --admin iemand@example.com
 *
 * --region <naam>  maakt de regio aan (slug afgeleid van de naam) als die
 *                  nog niet bestaat; herhaalbaar voor meerdere regio's.
 * --admin <email>  maakt een BESTAAND, geactiveerd account admin (de
 *                  allereerste admin; daarna kan dat via /admin/users).
 *
 * DATABASE_URL moet naar de doeldatabase wijzen; draai eerst de migraties.
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const regionNameSchema = z.string().trim().min(2).max(100);
const emailSchema = z.string().trim().toLowerCase().email();

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv: string[]): { regions: string[]; admins: string[] } {
  const regions: string[] = [];
  const admins: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if ((flag === "--region" || flag === "--admin") && value === undefined) {
      throw new Error(`${flag} verwacht een waarde.`);
    }
    if (flag === "--region") {
      regions.push(regionNameSchema.parse(value));
      i++;
    } else if (flag === "--admin") {
      admins.push(emailSchema.parse(value));
      i++;
    } else {
      throw new Error(`Onbekend argument: ${flag}`);
    }
  }
  if (regions.length === 0 && admins.length === 0) {
    throw new Error('Geef minstens één --region "<naam>" of --admin <email> op.');
  }
  return { regions, admins };
}

async function main() {
  const { regions, admins } = parseArgs(process.argv.slice(2));

  for (const name of regions) {
    const slug = slugify(name);
    if (!slug) throw new Error(`Regionaam "${name}" levert geen geldige slug op.`);
    const existing = await prisma.region.findUnique({ where: { slug } });
    if (existing) {
      console.log(`Regio "${existing.name}" (${slug}) bestaat al — overgeslagen.`);
    } else {
      await prisma.region.create({ data: { name, slug } });
      console.log(`Regio "${name}" (${slug}) aangemaakt.`);
    }
  }

  for (const email of admins) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Geen account met e-mailadres ${email} — registreer eerst.`);
    if (!user.isActive) throw new Error(`Account ${email} is nog niet geactiveerd.`);
    if (user.role === UserRole.ADMIN) {
      console.log(`${email} is al admin — overgeslagen.`);
      continue;
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } }),
      prisma.auditLog.create({
        data: {
          entityType: "user",
          entityId: user.id,
          action: "role_changed_bootstrap",
          performedBy: null,
          payload: { from: user.role, to: UserRole.ADMIN, via: "scripts/bootstrap-production.ts" },
        },
      }),
    ]);
    console.log(`${email} is nu admin.`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
