import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendEmail,
  maskEmailAddress,
  RESEND_API_URL,
  DEFAULT_EMAIL_FROM,
  EmailMessage,
} from "@/lib/auth/email";

const MESSAGE: EmailMessage = {
  to: "speler@example.com",
  subject: "Activeer je Padel Ladder account",
  body: "Klik hier: http://localhost:3000/activate?token=abc",
};
const API_KEY = "re_test_supergeheim_123";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.unstubAllEnvs();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("sendEmail — zonder RESEND_API_KEY (dev-fallback)", () => {
  it("logt naar de console en roept geen externe API aan", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const result = await sendEmail(MESSAGE);

    expect(result).toEqual({ ok: true, provider: "console" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("activate?token=abc"));
  });
});

describe("sendEmail — via Resend", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", API_KEY);
  });

  it("POST naar de Resend-API met Bearer-key, default afzender en tekst-body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "email-123" }));

    const result = await sendEmail(MESSAGE);

    expect(result).toEqual({ ok: true, provider: "resend", id: "email-123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      from: DEFAULT_EMAIL_FROM,
      to: ["speler@example.com"],
      subject: MESSAGE.subject,
      text: MESSAGE.body,
    });
    expect(logSpy).not.toHaveBeenCalled(); // activatielink niet in de logs bij echte verzending
  });

  it("gebruikt EMAIL_FROM als die gezet is", async () => {
    vi.stubEnv("EMAIL_FROM", "Padel Ladder <noreply@padelduel.nl>");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "email-456" }));

    await sendEmail(MESSAGE);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string).from).toBe("Padel Ladder <noreply@padelduel.nl>");
  });

  it("geeft een fout-resultaat terug (gooit niet) bij een HTTP-fout, zonder de API-key te lekken", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { statusCode: 403, name: "validation_error", message: `API key ${API_KEY} is invalid` }),
    );

    const result = await sendEmail(MESSAGE);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("onverwacht");
    expect(result.provider).toBe("resend");
    expect(result.error).toContain("HTTP 403");
    expect(result.error).not.toContain(API_KEY);
    expect(result.error).toContain("[redacted]");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0][0]);
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain("speler@example.com"); // ontvanger gemaskeerd
    expect(logged).toContain("s***@example.com");
  });

  it("geeft een fout-resultaat terug bij een netwerkfout/timeout", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const result = await sendEmail(MESSAGE);

    expect(result).toMatchObject({ ok: false, provider: "resend" });
    if (result.ok) throw new Error("onverwacht");
    expect(result.error).toContain("netwerkfout");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("verdraagt een niet-JSON foutbody", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));

    const result = await sendEmail(MESSAGE);

    expect(result).toEqual({ ok: false, provider: "resend", error: "HTTP 502" });
  });
});

describe("maskEmailAddress", () => {
  it("toont alleen de eerste letter en het domein", () => {
    expect(maskEmailAddress("jan.jansen@example.com")).toBe("j***@example.com");
  });

  it("maskeert een ongeldig adres volledig", () => {
    expect(maskEmailAddress("geen-adres")).toBe("***");
  });
});
