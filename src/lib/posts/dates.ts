import type { OperationalPost } from "@/lib/posts/types";

export const WORKSPACE_TIME_ZONE = "America/Sao_Paulo";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WORKSPACE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getPostTimestamp(post: OperationalPost) {
  return post.scheduledFor ?? post.publishedAt ?? post.createdAt;
}

export function toWorkspaceDateKey(value: string | Date) {
  const parts = dateKeyFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function createMonthGrid(year: number, month: number) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPreviousMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cellCount = firstWeekday + daysInMonth > 35 ? 42 : 35;

  return Array.from({ length: cellCount }, (_, index) => {
    const relativeDay = index - firstWeekday + 1;
    if (relativeDay < 1) {
      const previousMonthDate = new Date(
        Date.UTC(year, month - 1, daysInPreviousMonth + relativeDay),
      );
      return {
        date: previousMonthDate,
        day: previousMonthDate.getUTCDate(),
        inMonth: false,
      };
    }
    if (relativeDay > daysInMonth) {
      const nextMonthDate = new Date(
        Date.UTC(year, month + 1, relativeDay - daysInMonth),
      );
      return {
        date: nextMonthDate,
        day: nextMonthDate.getUTCDate(),
        inMonth: false,
      };
    }
    return {
      date: new Date(Date.UTC(year, month, relativeDay)),
      day: relativeDay,
      inMonth: true,
    };
  });
}

export function utcDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getMonthQueryRange(year: number, month: number) {
  // Query a small UTC buffer and apply the workspace timezone in the UI. This
  // keeps month edges correct without assuming the browser's local timezone.
  const from = new Date(Date.UTC(year, month, -1));
  const to = new Date(Date.UTC(year, month + 1, 3));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function startOfWorkspaceWeek(reference = new Date()) {
  const [year, month, day] = toWorkspaceDateKey(reference)
    .split("-")
    .map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const distanceFromMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - distanceFromMonday);
  return date;
}

export function addUtcDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}
