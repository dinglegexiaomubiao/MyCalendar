import { auth } from "@/lib/auth";
import { hasAccess } from "@/lib/access";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // 公开路径放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return;
  }

  // 静态资源放行
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return;
  }

  const userName = req.auth?.user?.name;
  if (!hasAccess(userName)) {
    // API 路由返回 403
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "无权限访问该日程表" },
        { status: 403 }
      );
    }
    // 页面路由重定向到登录页
    return NextResponse.redirect(
      new URL("/login?error=unauthorized", req.url)
    );
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
