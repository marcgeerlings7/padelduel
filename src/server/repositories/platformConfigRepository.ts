import { prisma } from "@/lib/prisma";

/**
 * Leest tunable parameters uit platform_config (nooit hardcoden op
 * meerdere plekken, zie CLAUDE.md). Korte in-memory cache zodat niet elk
 * request de database raakt, zonder config-wijzigingen een deploy te
 * laten vereisen.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: string; expiresAt: number }>();

async function getConfigValue(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const row = await prisma.platformConfig.findUniqueOrThrow({ where: { key } });
  cache.set(key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
  return row.value;
}

export async function getConfigNumber(key: string): Promise<number> {
  const value = await getConfigValue(key);
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`platform_config['${key}'] is geen geldig getal: ${value}`);
  }
  return parsed;
}

/** Uitsluitend voor tests: leegt de config-cache. */
export function __clearConfigCacheForTests(): void {
  cache.clear();
}
