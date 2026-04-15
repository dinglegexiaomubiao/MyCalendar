import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];

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

  const session = await auth();
  const isLoggedIn = !!session?.user;
  const name = session?.user?.name;

  console.log("[PROXY] pathname:", pathname, "isLoggedIn:", isLoggedIn, "name:", name);

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!name || !hasAccess(name)) {
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
