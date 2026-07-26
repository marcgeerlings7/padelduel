/**
 * Gimmick: als een gebruiker geen duo-naam invult, verzint het systeem
 * er een. Puur cosmetisch — geen tunable business-parameter, dus geen
 * platform_config-entry nodig.
 */

const ADJECTIVES = [
  "Smashing",
  "Blazing",
  "Sneaky",
  "Mighty",
  "Silent",
  "Golden",
  "Flying",
  "Wild",
  "Epic",
  "Turbo",
  "Fearless",
  "Electric",
  "Sneaky",
  "Ferocious",
  "Legendary",
];

const NOUNS = [
  "Falcons",
  "Bandits",
  "Ninjas",
  "Vipers",
  "Wolves",
  "Titans",
  "Rockets",
  "Rebels",
  "Gladiators",
  "Panthers",
  "Smashers",
  "Dynamo",
  "Vikings",
  "Avengers",
  "Chargers",
];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function generateDuoName(): string {
  return `${pickRandom(ADJECTIVES)} ${pickRandom(NOUNS)}`;
}
