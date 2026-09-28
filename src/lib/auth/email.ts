/**
 * E-mailverzending (post-v1, akkoord PO 2026-09-28).
 *
 * - `RESEND_API_KEY` gezet  -> verzending via de Resend HTTP-API
 *   (https://api.resend.com/emails) met `fetch`, geen extra SDK-dependency.
 *   Afzender: `EMAIL_FROM` (default: DEFAULT_EMAIL_FROM hieronder).
 * - `RESEND_API_KEY` leeg   -> dev-fallback: het bericht wordt naar de
 *   serverconsole gelogd (zoals vóór post-v1), zodat lokaal/QA de
 *   activatieflow end-to-end werkt zonder provider.
 *
 * `sendEmail` gooit bewust NOOIT bij een verzendfout: het geeft een
 * `EmailSendResult` terug en logt de fout (zonder secrets). De aanroeper
 * beslist wat een mislukte verzending betekent — bijv. registratie maakt
 * het account wél aan en meldt dat de mail opnieuw aangevraagd kan worden
 * (zie authService.register), i.p.v. een 500 terwijl het account al bestaat.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export type EmailSendResult =
  | { ok: true; provider: "resend" | "console"; id?: string }
  | { ok: false; provider: "resend"; error: string };

export const RESEND_API_URL = "https://api.resend.com/emails";
export const DEFAULT_EMAIL_FROM = "Padel Ladder <onboarding@resend.dev>";
const RESEND_TIMEOUT_MS = 10_000;
const MAX_ERROR_DETAIL_LENGTH = 200;

/** "jan.jansen@example.com" -> "j***@example.com" — geen volledige adressen in foutlogs. */
export function maskEmailAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

/**
 * Maakt een foutdetail veilig voor logs/response: verwijdert elk voorkomen
 * van de API-key (mocht een provider/proxy die ooit echoën) en kort in.
 */
function sanitizeErrorDetail(detail: string, apiKey: string): string {
  const withoutKey = apiKey ? detail.split(apiKey).join("[redacted]") : detail;
  return withoutKey.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_DETAIL_LENGTH);
}

async function sendViaResend(message: EmailMessage, apiKey: string): Promise<EmailSendResult> {
  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.body }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : "onbekende netwerkfout";
    return { ok: false, provider: "resend", error: sanitizeErrorDetail(`netwerkfout (${reason})`, apiKey) };
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : "";
    return {
      ok: false,
      provider: "resend",
      error: sanitizeErrorDetail(`HTTP ${response.status}${providerMessage ? ` — ${providerMessage}` : ""}`, apiKey),
    };
  }

  const id = body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : undefined;
  return { ok: true, provider: "resend", id };
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(`[dev e-mail] aan=${message.to} onderwerp="${message.subject}"\n${message.body}`);
    return { ok: true, provider: "console" };
  }

  const result = await sendViaResend(message, apiKey);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[e-mail] verzenden via Resend mislukt aan=${maskEmailAddress(message.to)} onderwerp="${message.subject}": ${result.error}`,
    );
  }
  return result;
}

export function buildActivationEmail(email: string, activationUrl: string): EmailMessage {
  return {
    to: email,
    subject: "Activeer je Padel Ladder account",
    body: `Klik op de volgende link om je account te activeren (verloopt na 24 uur):\n${activationUrl}`,
  };
}
