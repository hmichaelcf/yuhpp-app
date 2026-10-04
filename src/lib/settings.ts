import "server-only";

// Reads the settings table. Gate thresholds, caps, the model, and prices
// all live there so they can change without a deploy.

export type Settings = {
  text(key: string, fallback: string): string;
  number(key: string, fallback: number): number;
};

export async function loadSettings(db: D1Database): Promise<Settings> {
  const rows = (
    await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>()
  ).results;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    text: (key, fallback) => map.get(key) ?? fallback,
    number: (key, fallback) => {
      const n = Number(map.get(key));
      return Number.isFinite(n) ? n : fallback;
    },
  };
}
