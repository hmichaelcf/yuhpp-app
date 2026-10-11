import { appPath } from "./paths";

// Browser side of the workspace API: sends JSON to one of this app's routes
// and returns a message fit to show the member when something goes wrong.

export type ApiResult = { ok: boolean; message: string; data: Record<string, unknown> };

export async function callApi(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  try {
    const res = await fetch(appPath(path), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.ok) return { ok: true, message: "", data };
    const message =
      typeof data.message === "string"
        ? data.message
        : res.status === 401
          ? "Your session ended. Sign in again."
          : "That did not save. Please try again.";
    return { ok: false, message, data };
  } catch {
    return { ok: false, message: "That did not save. Check your connection and try again.", data: {} };
  }
}
