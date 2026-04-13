import { Solar } from "lunar-javascript";

export type ShiftType = "day" | "night" | "rest";
export type DayStatus =
  | "rao-day"
  | "rao-night"
  | "rao-rest"
  | "li-rest"
  | "both-rest";

export interface ScheduleConfig {
  raoBaseDate: string; // "2026-04-08"
  raoBaseCycleDay: number;
  raoCycleLength: number;
  raoDayShiftDays: number;
  raoNightShiftDays: number;
  raoRestDays: number;
  liRestType: "weekend_and_holiday" | "weekend_only";
}

export interface CalendarCell {
  date: string; // "2026-04-13"
  day: number; // 13
  isCurrentMonth: boolean;
  isToday: boolean;
  status: DayStatus;
  shiftType: ShiftType;
  cycleDay: number;
  isOverride: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isWorkdayMakeup: boolean;
  lunar: string;
  tags: string;
  highlighted?: boolean;
  dimmed?: boolean;
}

export const filterNames: Record<string, string> = {
  "rao-day": "饶白班",
  "rao-night": "饶晚班",
  "rao-rest": "饶休息日",
  "li-rest": "李休息日",
  "both-rest": "两人同休",
};

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getRaoCycleDay(dateStr: string, config: ScheduleConfig): number {
  const target = parseDateKey(dateStr);
  const base = parseDateKey(config.raoBaseDate);
  const diffTime = target.getTime() - base.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const cycleDay =
    ((diffDays + config.raoBaseCycleDay - 1) % config.raoCycleLength +
      config.raoCycleLength) %
      config.raoCycleLength +
    1;
  return cycleDay;
}

export function getRaoShiftType(
  dateStr: string,
  config: ScheduleConfig
): ShiftType {
  const cycleDay = getRaoCycleDay(dateStr, config);
  if (cycleDay >= 1 && cycleDay <= config.raoDayShiftDays) return "day";
  if (
    cycleDay > config.raoDayShiftDays &&
    cycleDay <= config.raoDayShiftDays + config.raoNightShiftDays
  )
    return "night";
  return "rest";
}

export function isLiRestDay(
  dateStr: string,
  holidays: Set<string>,
  workdays: Set<string>
): boolean {
  if (workdays.has(dateStr)) return false;
  const day = parseDateKey(dateStr).getDay();
  if (day === 0 || day === 6) return true;
  if (holidays.has(dateStr)) return true;
  return false;
}

export function getDayStatus(
  dateStr: string,
  config: ScheduleConfig,
  manualEdits: Record<string, DayStatus>,
  holidays: Set<string>,
  workdays: Set<string>
): DayStatus {
  if (Object.prototype.hasOwnProperty.call(manualEdits, dateStr)) {
    return manualEdits[dateStr];
  }
  const shiftType = getRaoShiftType(dateStr, config);
  const liRest = isLiRestDay(dateStr, holidays, workdays);
  if (shiftType === "rest") {
    return liRest ? "both-rest" : "rao-rest";
  }
  if (liRest) {
    return "li-rest";
  }
  if (shiftType === "day") return "rao-day";
  if (shiftType === "night") return "rao-night";
  return "rao-day";
}

export function shouldHighlight(
  dateStr: string,
  status: DayStatus,
  shiftType: ShiftType,
  activeFilters: string[]
): boolean {
  if (activeFilters.length === 0) return false;
  for (const filter of activeFilters) {
    if (filter === status) return true;
    if (filter === "rao-day" && shiftType === "day") return true;
    if (filter === "rao-night" && shiftType === "night") return true;
    if (filter === "rao-rest" && (status === "rao-rest" || status === "both-rest")) return true;
    if (filter === "li-rest" && (status === "li-rest" || status === "both-rest")) return true;
  }
  return false;
}

export function getLunarDate(date: Date): string {
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const lunar = solar.getLunar();
  const day = lunar.getDayInChinese();
  if (day === "初一") {
    return lunar.getMonthInChinese() + "月";
  }
  return day;
}

export function buildMonthCells(
  year: number,
  month: number, // 0-based
  config: ScheduleConfig,
  overrides: Record<string, DayStatus>,
  holidayMap: Record<string, { name: string; type: string }>,
  todayStr: string,
  activeFilters: string[] = []
): CalendarCell[] {
  const holidays = new Set(
    Object.entries(holidayMap)
      .filter(([, v]) => v.type === "holiday")
      .map(([k]) => k)
  );
  const workdays = new Set(
    Object.entries(holidayMap)
      .filter(([, v]) => v.type === "workday_makeup")
      .map(([k]) => k)
  );

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startOffset);

  const cells: CalendarCell[] = [];
  const totalCells = 42; // 6 rows x 7 cols

  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);
    const dateStr = formatDateKey(cellDate);
    const status = getDayStatus(dateStr, config, overrides, holidays, workdays);
    const shiftType = getRaoShiftType(dateStr, config);
    const cycleDay = getRaoCycleDay(dateStr, config);
    const isCurrentMonth = cellDate.getMonth() === month;
    const isToday = dateStr === todayStr;
    const isOverride = Object.prototype.hasOwnProperty.call(overrides, dateStr);
    const holidayInfo = holidayMap[dateStr];
    const isHoliday = holidayInfo?.type === "holiday";
    const isWorkdayMakeup = holidayInfo?.type === "workday_makeup";
    const highlighted =
      activeFilters.length > 0 &&
      shouldHighlight(dateStr, status, shiftType, activeFilters);

    let tags = "";
    if (status === "both-rest") {
      tags += `<div class="day-tag">同休</div>`;
    } else if (isHoliday) {
      tags += `<div class="day-tag">节</div>`;
    } else if (isWorkdayMakeup) {
      tags += `<div class="day-tag">班</div>`;
    }

    if (
      !isOverride &&
      (status === "rao-day" ||
        status === "rao-night" ||
        (status === "li-rest" && shiftType !== "rest"))
    ) {
      const shiftText = shiftType === "day" ? "白" : shiftType === "night" ? "晚" : "";
      if (shiftText) {
        tags += `<div class="day-tag" style="color:#666">${shiftText}</div>`;
      }
    }

    cells.push({
      date: dateStr,
      day: cellDate.getDate(),
      isCurrentMonth,
      isToday,
      status,
      shiftType,
      cycleDay,
      isOverride,
      isHoliday,
      holidayName: holidayInfo?.name,
      isWorkdayMakeup,
      lunar: getLunarDate(cellDate),
      tags,
    });
  }

  return cells;
}
