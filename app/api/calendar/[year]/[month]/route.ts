import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAccess, isPrivilegedUser } from "@/lib/access";
import { ensureDefaultCouple } from "@/lib/init-default";
import { prisma } from "@/lib/prisma";
import { buildMonthCells, DayStatus, formatDateKey } from "@/lib/calendar-logic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  if (!hasAccess(session.user.name)) {
    return NextResponse.json({ error: "无权限访问该日程表" }, { status: 403 });
  }

  let coupleId = session.user.coupleId;
  if (!coupleId && isPrivilegedUser(session.user.email)) {
    const defaultCouple = await ensureDefaultCouple();
    coupleId = defaultCouple.coupleId;
  }

  if (!coupleId) {
    return NextResponse.json({ error: "未绑定日历组" }, { status: 403 });
  }

  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { coupleId },
    });

    if (!schedule) {
      return NextResponse.json({ error: "排班配置不存在" }, { status: 404 });
    }

    const startDate = new Date(year, month - 1, 1);
    const bufferStart = new Date(startDate);
    bufferStart.setDate(bufferStart.getDate() - 7);
    const bufferEnd = new Date(year, month - 1 + 1, 7);

    const overrides = await prisma.calendarOverride.findMany({
      where: {
        coupleId,
        date: {
          gte: formatDateKey(bufferStart),
          lte: formatDateKey(bufferEnd),
        },
      },
    });

    const overrideMap: Record<string, DayStatus> = {};
    for (const o of overrides) {
      overrideMap[o.date] = o.status as DayStatus;
    }

    const holidays = await prisma.holiday.findMany({
      where: { year },
    });

    const holidayMap: Record<string, { name: string; type: string }> = {};
    for (const h of holidays) {
      holidayMap[h.date] = { name: h.name, type: h.type };
    }

    const adjacentHolidays = await prisma.holiday.findMany({
      where: {
        year: { in: [year - 1, year + 1] },
      },
    });
    for (const h of adjacentHolidays) {
      if (!holidayMap[h.date]) {
        holidayMap[h.date] = { name: h.name, type: h.type };
      }
    }

    const todayStr = formatDateKey(new Date());
    const cells = buildMonthCells(
      year,
      month - 1,
      schedule as unknown as Parameters<typeof buildMonthCells>[2],
      overrideMap,
      holidayMap,
      todayStr,
      []
    );

    return NextResponse.json({
      year,
      month,
      coupleId,
      schedule,
      cells,
    });
  } catch (error) {
    console.error("Calendar API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
