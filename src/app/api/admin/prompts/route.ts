import { NextResponse } from "next/server";
import { adminFromRequest } from "@/lib/admin";
import { bindings } from "@/lib/cloudflare";
import { readSheet, syncPrompts } from "@/lib/prompts";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST /app/api/admin/prompts
 * Admin only. Multipart form with one field, "file": the CSV export of the
 * yuhpp_prompts sheet. Returns what changed; never returns prompt text.
 */
export async function POST(request: Request) {
  const admin = await adminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "no_file", problems: ["Choose the CSV file to upload."] },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", problems: ["That file is too large to be the prompt sheet."] },
      { status: 400 },
    );
  }

  const { prompts, problems } = readSheet(await file.text());
  if (problems.length > 0) {
    return NextResponse.json({ error: "invalid_sheet", problems }, { status: 422 });
  }

  const { DB } = await bindings();
  const result = await syncPrompts(DB, prompts, admin.id);
  return NextResponse.json({ ok: true, result });
}
