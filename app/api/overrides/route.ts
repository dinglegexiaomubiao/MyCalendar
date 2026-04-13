import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultCouple } from "@/lib/init-default";
import { DayStatus } from "@/lib/calendar-logic";

const VALID_STATUSES: DayStatus[] = [
  "rao-day",
  "rao-night",
  "rao-rest",
  "li-rest",
  "both-rest",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coupleId, date, status }: { coupleId?: string; date?: string; status?: string } = body;

    if (!date || !status) {
      return NextResponse.json(
        { error: "Missing date or status" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status as DayStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let targetCoupleId = coupleId;
    if (!targetCoupleId) {
      const defaultCouple = await ensureDefaultCouple();
      targetCoupleId = defaultCouple.coupleId;
    }

    const override = await prisma.calendarOverride.upsert({
      where: {
        coupleId_date: {
          coupleId: targetCoupleId,
          date,
        },
      },
      update: {
        status,
      },
      create: {
        coupleId: targetCoupleId,
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
  try {
    const { searchParams } = new URL(request.url);
    const coupleId = searchParams.get("coupleId") || undefined;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json({ error: "Missing date" }, { status: 400 });
    }

    let targetCoupleId = coupleId;
    if (!targetCoupleId) {
      const defaultCouple = await ensureDefaultCouple();
      targetCoupleId = defaultCouple.coupleId;
    }

    await prisma.calendarOverride.deleteMany({
      where: {
        coupleId: targetCoupleId,
        date,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Override DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
