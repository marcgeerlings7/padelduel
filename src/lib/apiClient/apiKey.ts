import { randomBytes, createHash } from "node:crypto";

/**
 * API-keys zijn hoge-entropie, systeem-gegenereerde secrets (geen door
 * mensen bedachte wachtwoorden) — een snelle cryptografische hash
 * (SHA-256) is hier het juiste gereedschap, niet bcrypt (dat is bewust
 * traag om brute-force op LAGE-entropie input te bemoeilijken, wat hier
 * niet van toepassing is en alleen onnodige latency zou toevoegen).
 */
const KEY_PREFIX = "padel_live_";

export function generateApiKey(): { plaintextKey: string; keyHash: string } {
  const plaintextKey = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { plaintextKey, keyHash: hashApiKey(plaintextKey) };
}

export function hashApiKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}
