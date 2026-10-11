import Masthead from "./Masthead";
import Rail from "./Rail";
import type { StopId } from "@/lib/route-map";

// The signed-in workspace layout: masthead across the top, the route rail on
// the left (as on yuhpp.com), and the page on the right.

export default function AppShell({
  admin,
  active,
  children,
}: {
  admin: boolean;
  active?: StopId;
  children: React.ReactNode;
}) {
  return (
    <>
      <Masthead signedIn admin={admin} wide />
      <div className="layout">
        <Rail active={active} />
        <main className="shell-main">{children}</main>
      </div>
    </>
  );
}
