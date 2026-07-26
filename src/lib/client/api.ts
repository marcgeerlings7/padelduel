import { getStoredToken } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.error ?? "Er is iets misgegaan.", response.status);
  }
  return body as T;
}
