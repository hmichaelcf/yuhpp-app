import { redirect } from "next/navigation";
import PrintBar from "../../components/PrintBar";
import ResumeDocument from "../../components/ResumeDocument";
import { bindings } from "@/lib/cloudflare";
import { loadDraft } from "@/lib/resume-record";
import { currentMember } from "@/lib/session";

// /app/resume/print: the resume alone, two US Letter pages, ready for the
// browser's Save as PDF. Amber gaps and the headshot placeholder never print.

export const dynamic = "force-dynamic";

export const metadata = { title: "Resume | Yuhpp" };

export default async function PrintResume({ searchParams }: { searchParams: Promise<{ print?: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/login");
  const { DB } = await bindings();
  const [draft, query] = await Promise.all([loadDraft(DB, member.id, member.email), searchParams]);

  return (
    <div className="print-page">
      <PrintBar auto={query.print === "1"} />
      <ResumeDocument data={draft.data} />
    </div>
  );
}
