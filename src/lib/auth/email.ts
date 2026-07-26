/**
 * Pluggable e-mail-verzending. Er is nog geen productie-e-mailprovider
 * gekozen (PRD §14 open vraag) — deze dev-implementatie logt de
 * activatielink naar de console zodat de flow end-to-end te testen is.
 * Vervang `sendEmail` door een echte provider (Resend/Postmark/SES) zodra
 * die keuze gemaakt is; de rest van de auth-code roept alleen deze
 * functie aan en hoeft dan niet te wijzigen.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[dev e-mail] aan=${message.to} onderwerp="${message.subject}"\n${message.body}`,
  );
}

export function buildActivationEmail(email: string, activationUrl: string): EmailMessage {
  return {
    to: email,
    subject: "Activeer je Padel Ladder account",
    body: `Klik op de volgende link om je account te activeren (verloopt na 24 uur):\n${activationUrl}`,
  };
}
