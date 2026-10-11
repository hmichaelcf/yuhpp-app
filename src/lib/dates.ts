// Dates for display, in Pacific time. SQLite stores UTC as "YYYY-MM-DD HH:MM:SS".

function fromSqlite(sqlite: string): Date {
  return new Date(`${sqlite.replace(" ", "T")}Z`);
}

/** "Oct 4" */
export function shortDate(sqlite: string): string {
  return fromSqlite(sqlite).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
