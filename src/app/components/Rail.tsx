import Link from "next/link";
import RailScroll from "./RailScroll";
import { RAIL, type StopId } from "@/lib/route-map";

// The route rail from the public guide: every phase in order, the
// checkpoints between them, and the stops that run alongside. On a phone it
// becomes a row of chips that scrolls sideways.

export default function Rail({ active }: { active?: StopId }) {
  return (
    <nav className="rail" aria-label="The route">
      <p className="rail-title">The route</p>
      <div className="route">
        {RAIL.map((item, i) => {
          if (item.kind === "gate") {
            return (
              <div key={i} className="gate-mark" aria-hidden="true">
                <span />
              </div>
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
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`stop${item.loop ? " is-loop" : ""}${on ? " is-active" : ""}`}
              aria-current={on ? "page" : undefined}
            >
              <span className="dot" aria-hidden="true" />
              <span className="code">{item.code}</span>
              {item.name}
            </Link>
          );
        })}
      </div>
      <RailScroll />
    </nav>
  );
}
