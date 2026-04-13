import useSWR, { useSWRConfig } from "swr";
import { CalendarCell, DayStatus, ScheduleConfig } from "@/lib/calendar-logic";

export interface CalendarData {
  year: number;
  month: number;
  schedule: ScheduleConfig;
  cells: CalendarCell[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useCalendar(year: number, month: number) {
  const key = `/api/calendar/${year}/${month}`;
  const { data, error, isLoading } = useSWR<CalendarData>(key, fetcher);

  return {
    data,
    error,
    isLoading,
  };
}

export function useOverrideMutations() {
  const { mutate } = useSWRConfig();

  async function saveOverride(date: string, status: DayStatus) {
    const res = await fetch("/api/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, status }),
    });
    if (!res.ok) throw new Error("Failed to save override");
    return res.json();
  }

  async function deleteOverride(date: string) {
    const params = new URLSearchParams({ date });
    const res = await fetch(`/api/overrides?${params.toString()}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete override");
    return res.json();
  }

  function revalidateCalendar(year: number, month: number) {
    return mutate(`/api/calendar/${year}/${month}`);
  }

  return {
    saveOverride,
    deleteOverride,
    revalidateCalendar,
  };
}
