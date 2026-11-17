import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "ninho_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

function getPasscode(): string {
  return process.env.NINHO_ACCESS_PASSCODE?.trim() ?? "";
}

function getSigningSecret(): string {
  return (
    process.env.NINHO_SESSION_SECRET?.trim() ||
    getPasscode() ||
    "ninho-dev-fallback"
  );
}

export function isAuthEnabled(): boolean {
  return getPasscode().length > 0;
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyPasscode(candidate: string): boolean {
  const expected = getPasscode();
  if (!expected) return true;
  return safeEqualStrings(candidate.trim(), expected);
}

export function createSessionToken(nowSeconds = Math.floor(Date.now() / 1000)): string {
  const exp = nowSeconds + SESSION_TTL_SECONDS;
  const payload = String(exp);
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!token) return false;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return false;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const exp = Number.parseInt(payload, 10);
  if (!Number.isFinite(exp) || exp <= nowSeconds) return false;

  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");

  return safeEqualStrings(sig, expectedSig);
}

export function isRequestAuthorized(request: NextRequest): boolean {
  if (!isAuthEnabled()) return true;
  const cookieVal = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(cookieVal);
}
