import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthEnabled,
  isRequestAuthorized,
  SESSION_COOKIE_NAME,
  verifyPasscode,
} from "@/lib/auth/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    {
      authEnabled: isAuthEnabled(),
      authenticated: isRequestAuthorized(request),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { authenticated: true, authEnabled: false },
      { status: 200 }
    );
  }

  let body: { passcode?: string } = {};
  try {
    body = (await request.json()) as { passcode?: string };
  } catch {
    return NextResponse.json(
      { status: "ERROR", message: "Requisição inválida." },
      { status: 400 }
    );
  }

  const candidate = typeof body.passcode === "string" ? body.passcode : "";
  if (!verifyPasscode(candidate)) {
    return NextResponse.json(
      { status: "ERROR", message: "Senha incorreta." },
      { status: 401 }
    );
  }

  const res = NextResponse.json(
    { authenticated: true, authEnabled: true },
    { status: 200 }
  );
  res.cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ authenticated: false }, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
