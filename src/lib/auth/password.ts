import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Richtwaarde complexiteitseisen (PRD open vraag, geen bindend besluit
// elders): minimaal 10 tekens, met minstens 1 hoofdletter, 1 kleine
// letter en 1 cijfer.
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export function isPasswordComplexEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && PASSWORD_PATTERN.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Vaste, ongeldige hash om tegen te vergelijken wanneer een gebruiker niet
// bestaat — houdt de timing van een login-poging gelijk aan een poging
// met een bestaand e-mailadres, zodat e-mail-enumeratie via timing lastiger is.
export const DUMMY_PASSWORD_HASH =
  "$2b$10$Nc85nzC08Hwx7sDEF8g4WefYFLvMPM5M18qQT.LNmqeThIMQM4U8K";
