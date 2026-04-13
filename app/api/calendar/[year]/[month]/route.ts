import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultCouple } from "@/lib/init-default";
import { buildMonthCells, DayStatus, formatDateKey } from "@/lib/calendar-logic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> }
) {
  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  try {
    const { coupleId, schedule } = await ensureDefaultCouple();

    // Fetch overrides for the month range (with buffer for cross-month grid)
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

    // Fetch holidays for the year
    const holidays = await prisma.holiday.findMany({
      where: {
        year,
      },
    });

    const holidayMap: Record<string, { name: string; type: string }> = {};
    for (const h of holidays) {
      holidayMap[h.date] = { name: h.name, type: h.type };
    }

    // Also fetch adjacent years' holidays (for cross-month buffer)
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
      schedule,
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
