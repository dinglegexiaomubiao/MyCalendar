import { NextRequest, NextResponse } from "next/server";
import { auth, hasAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  if (!hasAccess(session.user.name)) {
    return NextResponse.json({ error: "无权限访问该日程表" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { inviteCode } = body as { inviteCode?: string };

    if (!inviteCode) {
      return NextResponse.json({ error: "请输入邀请码" }, { status: 400 });
    }

    const couple = await prisma.couple.findUnique({
      where: { inviteCode },
    });

    if (!couple) {
      return NextResponse.json({ error: "邀请码不存在" }, { status: 400 });
    }

    const memberCount = await prisma.user.count({
      where: { coupleId: couple.id },
    });

    if (memberCount >= 2) {
      return NextResponse.json(
        { error: "该日历组已满员（最多2人）" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { coupleId: couple.id },
    });

    return NextResponse.json({ success: true, coupleId: couple.id });
  } catch (error) {
    console.error("Bind couple error:", error);
    return NextResponse.json({ error: "绑定失败" }, { status: 500 });
  }
}
