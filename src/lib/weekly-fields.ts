// The weekly counts, shared by the server and the weekly form. They match the
// inputs the Weekly Pipeline Review prompt asks for, in its order.

export const COUNT_FIELDS = [
  { key: "applications", label: "Applications submitted", short: "Apps" },
  { key: "outreach", label: "Outreach sent", short: "Outreach" },
  { key: "replies", label: "Replies received", short: "Replies" },
  { key: "referrals", label: "Referrals secured", short: "Referrals" },
  { key: "recruiter_screens", label: "Recruiter screens", short: "Screens" },
  { key: "hm_rounds", label: "Hiring manager rounds", short: "HM rounds" },
  { key: "panels", label: "Panels and onsites", short: "Panels" },
  { key: "offers", label: "Offers", short: "Offers" },
  { key: "rejections", label: "Rejections", short: "Rejections" },
] as const;

export type CountKey = (typeof COUNT_FIELDS)[number]["key"];

export type Counts = Record<CountKey, number>;

export const MAX_COUNT = 9999;

export function emptyCounts(): Counts {
  return Object.fromEntries(COUNT_FIELDS.map((f) => [f.key, 0])) as Counts;
}

/** "Oct 6" from "2026-10-06". */
export function shortWeek(weekStart: string): string {
  return new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The one-line weekly number members post in Good company. */
export function weeklyNumberLine(weekStart: string, counts: Counts, focus?: string | null): string {
  const parts = COUNT_FIELDS.map((f) => `${f.short} ${counts[f.key]}`);
  const line = `Week of ${shortWeek(weekStart)} | ${parts.join(" | ")}`;
  return focus ? `${line} | Focus: ${focus.replace(/\s+/g, " ")}` : line;
}
