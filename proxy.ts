import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];
const ALLOWED_NAMES = ["李", "饶"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return;
  }

  const secret = process.env.AUTH_SECRET;
  const token = await getToken({ req, secret });
  const isLoggedIn = !!token;
  const name = typeof token?.name === "string" ? token.name : undefined;

  console.log("[PROXY] pathname:", pathname, "hasSecret:", !!secret, "isLoggedIn:", isLoggedIn, "name:", name);

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!name || !ALLOWED_NAMES.includes(name)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "无权限访问该日程表" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(
      new URL("/login?error=unauthorized", req.url)
    );
  }
}
