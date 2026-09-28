import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { signActivationToken } from "@/lib/auth/tokens";

// In-memory nabootsing van audit_log voor de (Postgres-backed) login-rate-limiter.
type AuditRow = { entityType: string; entityId: string; action: string; createdAt: Date };
const auditRows: AuditRow[] = [];

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: Omit<AuditRow, "createdAt"> }) => {
      auditRows.push({ ...data, createdAt: new Date() });
    }),
    findMany: vi.fn(
      async ({ where, take }: { where: { entityType: string; entityId: string; createdAt: { gt: Date } }; take: number }) =>
        auditRows
          .filter(
            (r) =>
              r.entityType === where.entityType &&
              r.entityId === where.entityId &&
              r.createdAt > where.createdAt.gt,
          )
          .reverse()
          .slice(0, take),
    ),
  },
};

const mockSendEmail = vi.fn();
const mockGetConfigNumber = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/email", () => ({
  sendEmail: mockSendEmail,
  buildActivationEmail: (email: string, url: string) => ({
    to: email,
    subject: "Activeer je account",
    body: url,
  }),
}));
vi.mock("@/server/repositories/platformConfigRepository", () => ({
  getConfigNumber: mockGetConfigNumber,
}));

// Import ná de vi.mock-calls (hoisting zorgt dat mocks al actief zijn).
const { register, activate, resendActivation, login, AuthError } = await import(
  "@/server/services/authService"
);

beforeEach(() => {
  vi.clearAllMocks();
  auditRows.length = 0;
  mockSendEmail.mockResolvedValue({ ok: true, provider: "console" });
  mockGetConfigNumber.mockImplementation(async (key: string) => {
    if (key === "login_max_attempts") return 3;
    if (key === "login_lockout_minutes") return 15;
    throw new Error(`onverwachte config-key in test: ${key}`);
  });
});

describe("register", () => {
  it("maakt een inactief account aan en verstuurt een activatiemail", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "user-1", email: "nieuw@example.com" });

    await register("nieuw@example.com", "Wachtwoord1");

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "nieuw@example.com", isActive: false }),
      }),
    );
    const createArgs = mockPrisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe("Wachtwoord1");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("geeft emailSent: true terug bij een geslaagde verzending", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "user-1", email: "nieuw@example.com" });

    await expect(register("nieuw@example.com", "Wachtwoord1")).resolves.toEqual({ emailSent: true });
  });

  it("maakt het account wél aan en geeft emailSent: false terug als de mail niet verstuurd kon worden (geen 500)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValueOnce({ id: "user-1", email: "nieuw@example.com" });
    mockSendEmail.mockResolvedValueOnce({ ok: false, provider: "resend", error: "HTTP 500" });

    await expect(register("nieuw@example.com", "Wachtwoord1")).resolves.toEqual({ emailSent: false });
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("geeft een generieke foutmelding bij een bestaand e-mailadres, zonder dit te bevestigen", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "existing", email: "bestaat@example.com" });

    await expect(register("bestaat@example.com", "Wachtwoord1")).rejects.toMatchObject({
      code: "registration_failed",
      httpStatus: 400,
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("activate", () => {
  it("activeert een geldig, nog niet gebruikt token", async () => {
    const token = await signActivationToken("user-1");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", isActive: false });

    await activate(token);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it("weigert een ongeldig token", async () => {
    await expect(activate("niet-een-geldig-token")).rejects.toMatchObject({
      code: "activation_invalid",
    });
  });

  it("weigert een reeds gebruikt token (account al actief)", async () => {
    const token = await signActivationToken("user-1");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", isActive: true });

    await expect(activate(token)).rejects.toMatchObject({
      code: "activation_already_used",
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

describe("resendActivation", () => {
  it("verstuurt een nieuwe mail voor een bestaand, nog niet geactiveerd account", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "x@example.com", isActive: false });
    await resendActivation("x@example.com");
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it("geeft hetzelfde generieke bericht voor een onbekend e-mailadres (geen enumeratie)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const messageUnknown = await resendActivation("onbekend@example.com");

    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "x@example.com", isActive: false });
    const messageKnown = await resendActivation("x@example.com");

    expect(messageUnknown).toBe(messageKnown);
    expect(mockSendEmail).toHaveBeenCalledTimes(1); // alleen voor het bekende, inactieve account
  });

  it("geeft ook bij een mislukte verzending hetzelfde generieke bericht (geen enumeratie)", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", email: "x@example.com", isActive: false });
    mockSendEmail.mockResolvedValueOnce({ ok: false, provider: "resend", error: "HTTP 500" });
    const messageFailed = await resendActivation("x@example.com");

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    const messageUnknown = await resendActivation("onbekend@example.com");

    expect(messageFailed).toBe(messageUnknown);
  });
});

describe("login", () => {
  it("geeft een sessietoken bij correcte, actieve credentials", async () => {
    const passwordHash = await hashPassword("Wachtwoord1");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      passwordHash,
      isActive: true,
      role: "USER",
    });

    const result = await login("test@example.com", "Wachtwoord1", "key-a");
    expect(result.token).toEqual(expect.any(String));
  });

  it("geeft dezelfde generieke fout voor onbekend e-mailadres als voor fout wachtwoord", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    let unknownEmailMessage = "";
    try {
      await login("onbekend@example.com", "Wachtwoord1", "key-b1");
    } catch (err) {
      unknownEmailMessage = (err as InstanceType<typeof AuthError>).message;
    }

    const passwordHash = await hashPassword("Wachtwoord1");
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      passwordHash,
      isActive: true,
      role: "USER",
    });
    let wrongPasswordMessage = "";
    try {
      await login("test@example.com", "FoutWachtwoord1", "key-b2");
    } catch (err) {
      wrongPasswordMessage = (err as InstanceType<typeof AuthError>).message;
    }

    expect(unknownEmailMessage).toBe(wrongPasswordMessage);
  });

  it("weigert een correct wachtwoord voor een niet-geactiveerd account, zonder de rate limit te tellen", async () => {
    const passwordHash = await hashPassword("Wachtwoord1");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash,
      isActive: false,
      role: "USER",
    });

    await expect(login("test@example.com", "Wachtwoord1", "key-c")).rejects.toMatchObject({
      code: "account_not_active",
    });

    // Nog steeds mogelijk om het (correct) opnieuw te proberen zonder blokkade.
    await expect(login("test@example.com", "Wachtwoord1", "key-c")).rejects.toMatchObject({
      code: "account_not_active",
    });
  });

  it("blokkeert na het geconfigureerde aantal mislukte pogingen", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(login("test@example.com", "fout1", "key-d")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
    await expect(login("test@example.com", "fout2", "key-d")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
    await expect(login("test@example.com", "fout3", "key-d")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
    // 4e poging binnen dezelfde key: geblokkeerd, ongeacht credentials.
    await expect(login("test@example.com", "fout4", "key-d")).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("schrijft bij een geslaagde login zonder eerdere mislukkingen géén audit-rij, na mislukkingen wél een reset", async () => {
    const passwordHash = await hashPassword("Wachtwoord1");
    const activeUser = { id: "user-1", passwordHash, isActive: true, role: "USER" };

    mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
    await login("test@example.com", "Wachtwoord1", "key-e");
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();

    mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
    await expect(login("test@example.com", "Fout1", "key-e")).rejects.toMatchObject({
      code: "invalid_credentials",
    });
    mockPrisma.user.findUnique.mockResolvedValueOnce(activeUser);
    await login("test@example.com", "Wachtwoord1", "key-e");

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "login_rate_limit_reset" }) }),
    );
  });
});
