import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (!origin) return headers;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) {
    return NextResponse.next();
  }

  const requestOrigin = request.headers.get("origin");
  const allowOrigin =
    requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : null;

  if (request.method === "OPTIONS") {
    if (!allowOrigin) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(allowOrigin),
    });
  }

  const response = NextResponse.next();
  if (allowOrigin) {
    const h = corsHeaders(allowOrigin);
    h.forEach((value, key) => response.headers.set(key, value));
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
