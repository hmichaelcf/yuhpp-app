import Link from "next/link";
import RailScroll from "./RailScroll";
import { RAIL, type StopId } from "@/lib/route-map";
import type { PhaseId } from "@/lib/phases";

// The menu: the member's Home card on top, then the route from the public
// guide (every phase in order, the checkpoints between them, and the stops
// that run alongside). The member's own phase carries the "Your phase" tag and
// the only filled dot; it moves only when the member changes phase. The page
// being viewed gets a hollow ring and a thin line instead. Phases before the
// member's are filled in. On a phone it becomes a row of chips that scrolls
// sideways: your phase is the filled chip, the page you are on is outlined.

export type RailHome = {
  initials: string;
  name: string;
  /** "You are in 02 Positioning", or a prompt to pick a phase. */
  where: string;
  phase: PhaseId | null;
};

export default function Rail({ active, home }: { active?: StopId; home: RailHome }) {
  const phaseAt = home.phase ? RAIL.findIndex((r) => r.kind === "stop" && r.id === home.phase) : -1;
  const homeOn = active === "home";
  return (
    <nav className="rail" aria-label="Menu">
      <Link href="/" className={homeOn ? "rail-home is-active" : "rail-home"} aria-current={homeOn ? "page" : undefined}>
        <span className="rail-home-avatar" aria-hidden="true">
          {home.initials}
        </span>
        <span className="rail-home-text">
          <span className="rail-home-label">Home</span>
          <span className="rail-home-name">{home.name}</span>
          <span className="rail-home-where">{home.where}</span>
        </span>
      </Link>

      <p className="rail-title">The route</p>
      <div className="route">
        {RAIL.map((item, i) => {
          if (item.kind === "gate") {
            return (
              <div key={i} className={phaseAt > i ? "gate-mark is-done" : "gate-mark"} aria-hidden="true">
                <span />
              </div>
            );
          }
          if (item.kind === "sub") {
            const on = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={[ "stop", "is-sub", on ? "is-active" : "", i < phaseAt ? "is-done" : ""].filter(Boolean).join(" ")}
                aria-current={on ? "page" : undefined}
              >
                <span className="dot" aria-hidden="true" />
                {item.name}
              </Link>
            );
          }
          if (item.kind === "group") {
            return (
              <p key={i} className="rail-group">
                {item.label}
              </p>
            );
          }
          const on = item.id === active;
          const here = item.id === home.phase;
          const done = i < phaseAt;
          const cls = ["stop", item.loop ? "is-loop" : "", on ? "is-active" : "", here ? "is-here" : "", done ? "is-done" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <Link key={item.id} href={item.href} className={cls} aria-current={on ? "page" : undefined}>
              <span className="dot" aria-hidden="true" />
              <span className="code">{item.code}</span>
              {item.name}
              {here ? <span className="here-tag">Your phase</span> : null}
            </Link>
          );
        })}
      </div>
      <RailScroll />
    </nav>
  );
}
