import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET ontbreekt in de omgevingsconfiguratie");
  }
  return new TextEncoder().encode(secret);
}

const ACTIVATION_TOKEN_TTL = "24h";
const SESSION_TOKEN_TTL = "2h";

export type ActivationTokenPayload = {
  sub: string; // user id
  purpose: "activate";
};

export type SessionTokenPayload = {
  sub: string; // user id
  role: "USER" | "ADMIN";
};

export async function signActivationToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "activate" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACTIVATION_TOKEN_TTL)
    .sign(getSecret());
}

export type TokenVerifyResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: "expired" | "invalid" };

export async function verifyActivationToken(
  token: string,
): Promise<TokenVerifyResult<ActivationTokenPayload>> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "activate" || typeof payload.sub !== "string") {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, payload: { sub: payload.sub, purpose: "activate" } };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}

export async function signSessionToken(userId: string, role: "USER" | "ADMIN"): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TOKEN_TTL)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<TokenVerifyResult<SessionTokenPayload>> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || (payload.role !== "USER" && payload.role !== "ADMIN")) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, payload: { sub: payload.sub, role: payload.role } };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}
