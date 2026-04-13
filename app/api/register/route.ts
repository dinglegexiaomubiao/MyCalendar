import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password, inviteCode } = body as {
      email: string;
      name: string;
      password: string;
      inviteCode?: string;
    };

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "请填写完整信息" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要6位" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    let coupleId: string | undefined;

    if (inviteCode) {
      const couple = await prisma.couple.findUnique({
        where: { inviteCode },
      });
      if (!couple) {
        return NextResponse.json(
          { error: "邀请码不存在" },
          { status: 400 }
        );
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
      coupleId = couple.id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        coupleId,
      },
    });

    if (!coupleId) {
      const newCouple = await prisma.couple.create({
        data: {
          schedule: {
            create: {
              raoBaseDate: "2026-04-08",
              raoBaseCycleDay: 7,
              raoCycleLength: 9,
              raoDayShiftDays: 4,
              raoNightShiftDays: 3,
              raoRestDays: 2,
              liRestType: "weekend_and_holiday",
            },
          },
        },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { coupleId: newCouple.id },
      });
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}
