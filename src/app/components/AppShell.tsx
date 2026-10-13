import Masthead from "./Masthead";
import Rail, { type RailHome } from "./Rail";
import { isPhase, phaseLabel } from "@/lib/phases";
import type { StopId } from "@/lib/route-map";
import { currentMember } from "@/lib/session";

// The signed-in workspace layout: masthead across the top, the menu on the
// left (the member's Home card above the route), and the page on the right.
// The member lookup is cached per request, so this adds no database reads to
// a page that already called currentMember().

export default async function AppShell({
  admin,
  active,
  children,
}: {
  admin: boolean;
  active?: StopId;
  children: React.ReactNode;
}) {
  const member = await currentMember();
  const first = member?.first_name ?? "";
  const last = member?.last_name ?? "";
  const name = [first, last].filter(Boolean).join(" ") || member?.email || "Your account";
  const initials =
    (first[0] ?? "") + (last[0] ?? "") || (member?.email?.[0] ?? "Y");
  const saved = member?.current_phase;
  const phase = isPhase(saved) ? saved : null;
  const home: RailHome = {
    initials: initials.toUpperCase(),
    name,
    where: phase ? `You are in ${phaseLabel(phase)}` : "Tell us where you are",
    phase,
  };
  return (
    <>
      <Masthead signedIn admin={admin} wide />
      <div className="layout">
        <Rail active={active} home={home} />
        <main className="shell-main">{children}</main>
      </div>
    </>
  );
}
