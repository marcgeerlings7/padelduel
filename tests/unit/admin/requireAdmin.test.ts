import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth/tokens";

const mockPrisma = {
  user: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { requireAdmin } = await import("@/lib/auth/requireAdmin");

function requestWithToken(token?: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/users", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("geeft 401 zonder (geldig) token", async () => {
    const result = await requireAdmin(requestWithToken());
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("laat een admin door als de database de admin-rol bevestigt", async () => {
    const token = await signSessionToken("admin-1", "ADMIN");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "admin-1", role: "ADMIN", isActive: true });

    const result = await requireAdmin(requestWithToken(token));

    expect(result).toEqual({ id: "admin-1", role: "ADMIN" });
  });

  it("weigert (403) een token met ADMIN-rol als de gebruiker inmiddels gedegradeerd is", async () => {
    const token = await signSessionToken("oud-admin", "ADMIN");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "oud-admin", role: "USER", isActive: true });

    const result = await requireAdmin(requestWithToken(token));

    expect((result as NextResponse).status).toBe(403);
  });

  it("weigert (403) een gewone gebruiker", async () => {
    const token = await signSessionToken("user-1", "USER");
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user-1", role: "USER", isActive: true });

    const result = await requireAdmin(requestWithToken(token));

    expect((result as NextResponse).status).toBe(403);
  });
});
