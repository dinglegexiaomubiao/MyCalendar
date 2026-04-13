import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DayStatus } from "@/lib/calendar-logic";

const VALID_STATUSES: DayStatus[] = [
  "rao-day",
  "rao-night",
  "rao-rest",
  "li-rest",
  "both-rest",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const coupleId = session.user.coupleId;
  if (!coupleId) {
    return NextResponse.json({ error: "未绑定日历组" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { date, status }: { date?: string; status?: string } = body;

    if (!date || !status) {
      return NextResponse.json(
        { error: "Missing date or status" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status as DayStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const override = await prisma.calendarOverride.upsert({
      where: {
        coupleId_date: {
          coupleId,
          date,
        },
      },
      update: {
        status,
      },
      create: {
        coupleId,
        date,
        status,
      },
    });

    return NextResponse.json({ success: true, override });
  } catch (error) {
    console.error("Override POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const coupleId = session.user.coupleId;
  if (!coupleId) {
    return NextResponse.json({ error: "未绑定日历组" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    await prisma.calendarOverride.deleteMany({
      where: {
        coupleId,
        date,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Override DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
